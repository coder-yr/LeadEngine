import logging
import os
from typing import List

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from ai.SearchRouter import SearchRouter
from ai.SearchPlanner import SearchPlanner

logger = logging.getLogger(__name__)

class SearchRouterSource(BaseDiscoverySource):
    """
    Tier 4 Adaptive Discovery Source.
    Replaces gemini_search.py by acting as the bridge into the AI Orchestration layer.
    """
    name = "search_router"
    tier = 4 # Adaptive/Secondary
    reliability_stars = 5
    
    def __init__(self):
        super().__init__()
        self.router = SearchRouter()

    async def search(
        self, 
        keyword: str, 
        city: str, 
        max_results: int, 
        discovered_companies: List[str] = None,
        timeout_sec: int = 900,
        coverage_score: float = 0.0
    ) -> List[DiscoveryRecord]:
        
        logger.info(f"[SearchRouterSource] Engaging Search Planner for '{keyword} {city}'")
        
        # 1. Plan
        queries = SearchPlanner.expand_query(keyword, city)
        logger.info(f"[SearchRouterSource] Planned {len(queries)} semantic queries.")
        
        # 2. Route & Execute
        records = await self.router.execute_search(
            queries=queries,
            city=city,
            target_results=max_results,
            discovered_companies=discovered_companies or [],
            coverage_score_before=coverage_score,
            timeout_sec=timeout_sec
        )
        
        logger.info(f"[SearchRouterSource] Search Router successfully orchestrated {len(records)} verified records.")
        return records
