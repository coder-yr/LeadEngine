import logging
import os
import json
import time
from typing import List, Dict, Any, Optional

import redis
import httpx

from ai.providers.SearchProvider import SearchProvider
from discovery.base_source import DiscoveryRecord
from discovery.parser.gemini_parser import GeminiParser

logger = logging.getLogger(__name__)

class OpenRouterProvider(SearchProvider):
    """
    Search Provider wrapper for OpenRouter API with Web Search capabilities.
    Priority is on models that support native live search (like Perplexity).
    """
    
    name = "openrouter"
    supports_live_search = True
    
    def __init__(self):
        super().__init__()
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.parser = GeminiParser() # Reuse the robust Gemini parser
        
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
        self.cache_ttl = int(os.getenv("SEARCH_CACHE_TTL", 604800))
        
    async def check_health(self) -> Dict[str, Any]:
        """Check if API key exists."""
        is_healthy = bool(self.api_key)
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "reason": "Ready" if is_healthy else "Missing OPENROUTER_API_KEY"
        }

    async def search(
        self,
        keyword: str,
        city: str,
        target_results: int,
        discovered_companies: List[str] = None,
        timeout_sec: Optional[int] = None
    ) -> List[DiscoveryRecord]:
        
        if not self.api_key:
            logger.warning("[OpenRouterProvider] Cannot run - Missing API Key.")
            return []

        if not discovered_companies:
            discovered_companies = []

        # Load Prompt Template
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "..", "discovery", "prompts", "discovery.txt")
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                template = f.read()
        except FileNotFoundError:
            logger.error("[OpenRouterProvider] discovery.txt prompt template not found.")
            return []

        q = f"{keyword} {city}"
        cache_key = self._get_cache_key(q)
        cached_data = self.redis.get(cache_key)
        
        if cached_data:
            logger.info(f"[OpenRouterProvider] Cache Hit for query: {q}")
            parsed_records = json.loads(cached_data)
        else:
            logger.info(f"[OpenRouterProvider] Querying OpenRouter for: {q}")
            
            prompt = template.replace("{{KEYWORD}}", q)
            prompt = prompt.replace("{{CITY}}", city)
            prompt = prompt.replace("{{TARGET_RESULTS}}", str(target_results))
            prompt = prompt.replace("{{CATEGORY}}", keyword)
            
            existing_names = ", ".join(discovered_companies) if discovered_companies else "None"
            prompt = prompt.replace("{{DISCOVERED_COMPANIES}}", existing_names)

            try:
                # OpenRouter requires web-search enabled models like Perplexity Sonar
                # We use openrouter/auto which can fallback, but specify plugins if needed
                payload = {
                    "model": "perplexity/llama-3.1-sonar-huge-128k-online", 
                    "messages": [
                        {"role": "system", "content": "You are a lead generation search engine. Return JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                }
                
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000", # Required by OpenRouter
                    "X-Title": "LeadEngine V3"
                }

                async with httpx.AsyncClient(timeout=timeout_sec or 60.0) as client:
                    resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
                    resp.raise_for_status()
                    
                    resp_json = resp.json()
                    content = resp_json["choices"][0]["message"]["content"]
                    
                    # Ensure it is a list
                    if content.strip().startswith("{"):
                        # Sometime models wrap lists in an object {"companies": [...]}
                        content_dict = json.loads(content)
                        if "companies" in content_dict:
                            raw_json = content_dict["companies"]
                        else:
                            raw_json = [content_dict]
                    else:
                        raw_json = json.loads(content)

                    parsed_records = self.parser.parse_discovery_results(raw_json)
                    
                    if parsed_records:
                        self.redis.setex(cache_key, self.cache_ttl, json.dumps(parsed_records))

            except httpx.HTTPStatusError as e:
                logger.error(f"[OpenRouterProvider] HTTP Error: {e.response.status_code}")
                raise
            except Exception as e:
                logger.error(f"[OpenRouterProvider] Unexpected error: {e}")
                raise

        # Convert to DiscoveryRecord
        all_extracted_records = []
        for rec_dict in parsed_records:
            record = DiscoveryRecord(
                business_name=rec_dict.get("business_name", "Unknown"),
                source=self.name,
                website=rec_dict.get("website", ""),
                phone=rec_dict.get("phone", ""),
                email=rec_dict.get("email", ""),
                address=rec_dict.get("address", "")
            )
            
            record.quality_score = rec_dict.get("confidence", 80)
            record.metadata = {
                "provider": self.name,
                "searchQuery": q,
                "verification": rec_dict.get("verification", {}),
                "why_selected": rec_dict.get("why_selected", "")
            }
            all_extracted_records.append(record)

        return all_extracted_records[:target_results]
