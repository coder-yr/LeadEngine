import logging
import os
import time
from typing import List

from ai.providers.SearchProvider import SearchProvider
from ai.providers.GeminiProvider import GeminiProvider
from ai.providers.BraveProvider import BraveProvider
from ai.providers.TavilyProvider import TavilyProvider
from ai.SearchMemory import SearchMemory
from ai.VerificationEngine import VerificationEngine
from discovery.base_source import DiscoveryRecord

logger = logging.getLogger(__name__)

class SearchRouter:
    """
    Central Orchestrator for all AI and External Search Providers.
    Selects the best provider based on health, quota, and assigned weights.
    Implements automatic fallback if a provider fails or rate-limits.
    """
    
    def __init__(self):
        self.memory = SearchMemory()
        
        # Load available providers
        self.providers: dict[str, SearchProvider] = {
            "gemini": GeminiProvider(),
            "brave": BraveProvider(),
            "tavily": TavilyProvider()
        }
        
        # Load weights from config (e.g. "gemini=100,brave=70,tavily=60")
        self.weights = {}
        priority_str = os.getenv("SEARCH_PROVIDER_PRIORITY", "gemini=100,brave=70,tavily=60")
        for item in priority_str.split(","):
            if "=" in item:
                prov, weight = item.split("=")
                self.weights[prov.strip().lower()] = int(weight.strip())
                
    async def _get_ranked_providers(self) -> List[SearchProvider]:
        """
        Ranks providers based on assigned weights and current health.
        Unhealthy providers (missing API keys, recent failures) are pushed to the bottom or excluded.
        """
        ranked = []
        for name, provider in self.providers.items():
            # Check basic config health
            health_check = await provider.check_health()
            if health_check["status"] == "unhealthy":
                logger.debug(f"[SearchRouter] Skipping {name} - {health_check['reason']}")
                continue
                
            # Check dynamic telemetry health
            dyn_health = self.memory.get_provider_health(name)
            if not dyn_health["is_healthy"]:
                logger.info(f"[SearchRouter] Deprioritizing {name} due to recent failures.")
                base_weight = 0 # Push to the very bottom
            else:
                base_weight = self.weights.get(name, 50)
                
            ranked.append((base_weight, provider))
            
        # Sort by weight descending
        ranked.sort(key=lambda x: x[0], reverse=True)
        return [p for w, p in ranked]

    async def execute_search(
        self,
        queries: List[str],
        city: str,
        target_results: int,
        discovered_companies: List[str],
        coverage_score_before: float,
        timeout_sec: int = 900
    ) -> List[DiscoveryRecord]:
        """
        Executes search across the ordered list of queries, falling back through providers as needed.
        """
        ranked_providers = await self._get_ranked_providers()
        
        if not ranked_providers:
            logger.error("[SearchRouter] No healthy providers available!")
            return []
            
        all_records = []
        # Initialize seen_domains with the already discovered companies so we don't ask the AI for leads we already have!
        seen_domains = set()
        if discovered_companies:
            for domain in discovered_companies:
                seen_domains.add(domain.lower().replace("www.", ""))
        
        # Calculate time budget
        start_time = time.time()
        
        for query in queries:
            if len(all_records) >= target_results:
                break
                
            if time.time() - start_time > timeout_sec:
                logger.warning("[SearchRouter] Global timeout reached. Returning partial results.")
                break
                
            success = False
            for provider in ranked_providers:
                prov_start = time.time()
                try:
                    logger.info(f"[SearchRouter] Attempting '{query}' via {provider.name}...")
                    
                    # Allocate remaining time to the provider
                    remaining_time = max(10, int(timeout_sec - (time.time() - start_time)))
                    
                    records = await provider.search(
                        keyword=query.replace(f" {city}", ""), # Clean up if city is already in query
                        city=city,
                        target_results=target_results - len(all_records),
                        discovered_companies=discovered_companies,
                        timeout_sec=remaining_time
                    )
                    
                    # Verify records using the Engine
                    verified_records = VerificationEngine.verify_records(records)
                    
                    # Dedup inside the router flow
                    added_this_round = 0
                    for rec in verified_records:
                        domain = rec.domain if hasattr(rec, 'domain') else rec.website.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0] if rec.website else rec.business_name
                        if domain and domain not in seen_domains:
                            seen_domains.add(domain)
                            all_records.append(rec)
                            discovered_companies.append(rec.business_name)
                            added_this_round += 1
                            
                    prov_latency = time.time() - prov_start
                    self.memory.record_search(
                        query=query, provider=provider.name, latency=prov_latency,
                        companies_found=added_this_round, coverage_score_before=coverage_score_before,
                        is_success=True
                    )
                    
                    success = True
                    
                    if len(all_records) >= target_results:
                        break # Success! Break out of fallback loop because we hit the target
                    
                    # Target not reached yet! 
                    # Continue to the NEXT provider (e.g. Brave) for this exact same query
                    # to aggressively squeeze out more leads using the discovered_companies exclusion list!

                except Exception as e:
                    prov_latency = time.time() - prov_start
                    logger.warning(f"[SearchRouter] {provider.name} failed on '{query}': {e}. Falling back to next provider.")
                    self.memory.record_search(
                        query=query, provider=provider.name, latency=prov_latency,
                        companies_found=0, coverage_score_before=coverage_score_before,
                        is_success=False, error_msg=str(e)
                    )
                    continue # Fallback to next provider
                    
            if not success:
                logger.error(f"[SearchRouter] All providers failed for query '{query}'.")
                
        return all_records
