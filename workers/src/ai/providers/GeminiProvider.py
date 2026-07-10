import logging
import os
import json
import time
from typing import List, Dict, Any, Optional

import redis

from ai.providers.SearchProvider import SearchProvider
from discovery.base_source import DiscoveryRecord
from ai.gemini_client import GeminiClient, GeminiError, GeminiRateLimitError
from discovery.parser.gemini_parser import GeminiParser

logger = logging.getLogger(__name__)

class GeminiProvider(SearchProvider):
    """
    Search Provider wrapper for Gemini API with Google Search Grounding.
    """
    
    name = "gemini"
    supports_live_search = True
    
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
        self.cache_ttl = int(os.getenv("SEARCH_CACHE_TTL", 604800))
        
    async def check_health(self) -> Dict[str, Any]:
        """Check if Gemini API key exists and client is initialized."""
        is_healthy = self.client.client is not None
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "reason": "API client initialized" if is_healthy else "Missing GEMINI_API_KEY"
        }

    async def search(
        self,
        keyword: str,
        city: str,
        target_results: int,
        discovered_companies: List[str] = None,
        timeout_sec: Optional[int] = None
    ) -> List[DiscoveryRecord]:
        
        start_time = time.time()
        if not self.client.client:
            logger.warning("[GeminiProvider] Cannot run - API Client not initialized.")
            return []

        if not discovered_companies:
            discovered_companies = []

        # Load Prompt Template
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "..", "discovery", "prompts", "discovery.txt")
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                template = f.read()
        except FileNotFoundError:
            logger.error("[GeminiProvider] discovery.txt prompt template not found.")
            return []

        q = f"{keyword} {city}"
        cache_key = self._get_cache_key(q)
        cached_data = self.redis.get(cache_key)
        
        if cached_data:
            logger.info(f"[GeminiProvider] Cache Hit for query: {q}")
            parsed_records = json.loads(cached_data)
        else:
            logger.info(f"[GeminiProvider] Querying Gemini for: {q}")
            
            # Hydrate prompt
            prompt = template.replace("{{KEYWORD}}", q)
            prompt = prompt.replace("{{CITY}}", city)
            prompt = prompt.replace("{{TARGET_RESULTS}}", str(target_results))
            prompt = prompt.replace("{{CATEGORY}}", keyword)
            
            # Context of what we already found
            existing_names = ", ".join(discovered_companies) if discovered_companies else "None"
            prompt = prompt.replace("{{DISCOVERED_COMPANIES}}", existing_names)

            try:
                raw_json = await self.client.generate_json_with_search(prompt)
                parsed_records = self.parser.parse_discovery_results(raw_json)
                
                # Cache the validated results
                if parsed_records:
                    self.redis.setex(cache_key, self.cache_ttl, json.dumps(parsed_records))

            except GeminiRateLimitError:
                logger.warning("[GeminiProvider] Rate Limit Exceeded.")
                raise # Propagate to Router for fallback
            except GeminiError as e:
                logger.error(f"[GeminiProvider] Execution failed: {e}")
                raise
            except Exception as e:
                logger.error(f"[GeminiProvider] Unexpected error: {e}")
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
