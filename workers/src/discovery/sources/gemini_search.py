import logging
import json
import os
import time
import hashlib
from typing import List

import redis

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from ai.gemini_client import GeminiClient, GeminiError, GeminiRateLimitError
from discovery.parser.gemini_parser import GeminiParser

logger = logging.getLogger(__name__)

class GeminiSearchSource(BaseDiscoverySource):
    """
    Tier 2 Adaptive Discovery Source.
    Uses Gemini API with Google Search Grounding to find missing companies.
    Executes multiple semantic queries based on the core keyword.
    """
    name = "gemini_search"
    tier = 99 # Disabled as a direct source, now accessed via GeminiProvider inside SearchRouter
    reliability_stars = 4

    def __init__(self):
        super().__init__()
        self.client = GeminiClient()
        self.parser = GeminiParser()
        
        # Redis cache connection
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        redis_password = os.getenv("REDIS_PASSWORD", "")
        self.redis = redis.Redis(
            host=redis_host, 
            port=redis_port, 
            password=redis_password,
            decode_responses=True
        )
        self.cache_ttl = 7 * 24 * 60 * 60  # 7 days

    def _generate_multi_queries(self, keyword: str, city: str) -> List[str]:
        """Phase 6: Multi Query Strategy"""
        kw = keyword.lower()
        base = f"{keyword} {city}"
        
        if "dentist" in kw or "dental" in kw:
            return [
                base,
                f"Dental Clinic {city}",
                f"Orthodontist {city}",
                f"Cosmetic Dentist {city}",
                f"Smile Design {city}"
            ]
        elif "hotel" in kw:
            return [
                base,
                f"Boutique Hotel {city}",
                f"Luxury Resort {city}",
                f"Budget Accommodation {city}"
            ]
        elif "lawyer" in kw or "advocate" in kw:
            return [
                base,
                f"Law Firm {city}",
                f"Corporate Lawyer {city}",
                f"Legal Consultants {city}"
            ]
        
        # Default fallback
        return [base, f"Best {keyword} in {city}", f"Top {keyword} agencies {city}"]

    def _get_cache_key(self, query: str) -> str:
        """Phase 10: Cache Key Generation"""
        # Create a safe, hashed key for redis
        q_hash = hashlib.md5(query.encode('utf-8')).hexdigest()
        return f"gemini:search:v1:{q_hash}"

    async def search(self, keyword: str, city: str, max_results: int, discovered_companies: List[str] = None, timeout_sec: int = None) -> List[DiscoveryRecord]:
        """
        Executes the adaptive Gemini search.
        Requires `discovered_companies` context to prevent duplicates.
        """
        start_time = time.time()
        
        if not self.client.client:
            logger.warning("[GeminiSearchSource] Cannot run - API Client not initialized.")
            return []

        if not discovered_companies:
            discovered_companies = []

        # Load Prompt Template
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "discovery.txt")
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                template = f.read()
        except FileNotFoundError:
            logger.error("[GeminiSearchSource] discovery.txt prompt template not found.")
            return []

        queries = self._generate_multi_queries(keyword, city)
        all_extracted_records = []
        seen_domains = set()

        for q in queries:
            if len(all_extracted_records) >= max_results:
                break
                
            # If we are within 20 seconds of the hard timeout, return what we have so far
            if timeout_sec and (time.time() - start_time) > (timeout_sec - 20):
                logger.warning(f"[GeminiSearchSource] Approaching {timeout_sec}s timeout. Returning partial results early.")
                break

            cache_key = self._get_cache_key(q)
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                logger.info(f"[GeminiSearchSource] Cache Hit for query: {q}")
                parsed_records = json.loads(cached_data)
            else:
                logger.info(f"[GeminiSearchSource] Querying Gemini for: {q}")
                
                # Hydrate prompt
                prompt = template.replace("{{KEYWORD}}", q)
                prompt = prompt.replace("{{CITY}}", city)
                prompt = prompt.replace("{{TARGET_RESULTS}}", str(max_results - len(all_extracted_records)))
                prompt = prompt.replace("{{CATEGORY}}", keyword)
                
                # Context of what we already found
                existing_names = ", ".join(discovered_companies) if discovered_companies else "None"
                prompt = prompt.replace("{{DISCOVERED_COMPANIES}}", existing_names)

                try:
                    t0 = time.time()
                    raw_json = await self.client.generate_json_with_search(prompt)
                    duration = time.time() - t0
                    logger.info(f"[GeminiSearchSource] Gemini response received in {duration:.2f}s")
                    
                    parsed_records = self.parser.parse_discovery_results(raw_json)
                    
                    # Cache the validated results
                    if parsed_records:
                        self.redis.setex(cache_key, self.cache_ttl, json.dumps(parsed_records))

                except GeminiRateLimitError:
                    logger.warning("[GeminiSearchSource] Rate Limit Exceeded. Aborting further queries.")
                    break
                except GeminiError as e:
                    logger.error(f"[GeminiSearchSource] Execution failed: {e}")
                    continue
                except Exception as e:
                    logger.error(f"[GeminiSearchSource] Unexpected error: {e}")
                    continue

            # Convert to DiscoveryRecord and deduplicate
            for rec_dict in parsed_records:
                website = rec_dict.get("website", "").lower()
                domain = website.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
                
                if domain and domain not in seen_domains:
                    seen_domains.add(domain)
                    
                    record = DiscoveryRecord(
                        business_name=rec_dict.get("business_name", "Unknown"),
                        source=self.name,
                        website=website,
                        phone=rec_dict.get("phone", ""),
                        email=rec_dict.get("email", ""),
                        address=rec_dict.get("address", "")
                    )
                    
                    # Store provenance & verification
                    record.quality_score = rec_dict.get("confidence", 80)
                    record.metadata = {
                        "provider": "google_search_grounding",
                        "searchQuery": q,
                        "verification": rec_dict.get("verification", {}),
                        "why_selected": rec_dict.get("why_selected", "")
                    }
                    
                    all_extracted_records.append(record)

        return all_extracted_records[:max_results]
