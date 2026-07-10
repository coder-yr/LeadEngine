import logging
import os
import json
import time
from typing import List, Dict, Any, Optional

import redis
import httpx

from ai.providers.SearchProvider import SearchProvider
from discovery.base_source import DiscoveryRecord

logger = logging.getLogger(__name__)

class TavilyProvider(SearchProvider):
    """
    Search Provider wrapper for Tavily API.
    Used as an AI-powered search fallback.
    """
    
    name = "tavily"
    supports_live_search = True
    
    def __init__(self):
        super().__init__()
        self.api_key = os.getenv("TAVILY_API_KEY")
        
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        redis_password = os.getenv("REDIS_PASSWORD", "")
        self.redis = redis.Redis(
            host=redis_host, port=redis_port, password=redis_password, decode_responses=True
        )
        self.cache_ttl = int(os.getenv("SEARCH_CACHE_TTL", 604800))
        
    async def check_health(self) -> Dict[str, Any]:
        is_healthy = bool(self.api_key)
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "reason": "Ready" if is_healthy else "Missing TAVILY_API_KEY"
        }

    async def search(
        self, keyword: str, city: str, target_results: int, 
        discovered_companies: List[str] = None, timeout_sec: Optional[int] = None
    ) -> List[DiscoveryRecord]:
        
        if not self.api_key:
            logger.warning("[TavilyProvider] Cannot run - Missing API Key.")
            return []

        q = f"{keyword} {city} official website contact"
        cache_key = self._get_cache_key(q)
        cached_data = self.redis.get(cache_key)
        
        if cached_data:
            logger.info(f"[TavilyProvider] Cache Hit for query: {q}")
            return [DiscoveryRecord(**rec) for rec in json.loads(cached_data)]

        logger.info(f"[TavilyProvider] Querying Tavily for: {q}")
        
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "api_key": self.api_key,
            "query": q,
            "search_depth": "advanced",
            "include_answer": False,
            "max_results": min(target_results * 2, 20)
        }

        records = []
        try:
            async with httpx.AsyncClient(timeout=timeout_sec or 45.0) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    headers=headers,
                    json=payload
                )
                resp.raise_for_status()
                data = resp.json()

                if "results" in data:
                    for item in data["results"]:
                        title = item.get("title", "")
                        url = item.get("url", "")
                        desc = item.get("content", "")
                        
                        if any(d in url.lower() for d in ["justdial", "facebook", "linkedin", "instagram", "practo"]):
                            continue

                        record = DiscoveryRecord(
                            business_name=title.split("|")[0].split("-")[0].strip() or "Unknown",
                            source=self.name,
                            website=url,
                            metadata={"description": desc, "provider": self.name}
                        )
                        record.quality_score = 65 
                        records.append(record)

            if records:
                self.redis.setex(cache_key, self.cache_ttl, json.dumps([r.to_legacy_dict() for r in records]))

        except httpx.HTTPStatusError as e:
            logger.error(f"[TavilyProvider] HTTP Error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"[TavilyProvider] Unexpected error: {e}")
            raise

        return records[:target_results]
