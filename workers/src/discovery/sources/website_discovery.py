"""
website_discovery.py — Tier 1 Company Website Discovery source.

Searches DuckDuckGo for direct company websites using targeted queries,
then validates each result to ensure it's a real company domain using
the shared ddg_parser.
"""

from __future__ import annotations

import logging
from typing import List, Set

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.sources.ddg_parser import search_ddg, DEFAULT_EXCLUDED_DOMAINS

logger = logging.getLogger(__name__)


class WebsiteDiscoverySource(BaseDiscoverySource):
    name = "website_discovery"
    tier = 1
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        queries = [
            f'"{keyword} {city} official website"',
            f'"{keyword}" near "{city}" -directory'
        ]
        
        extracted: List[DiscoveryRecord] = []
        seen_domains: Set[str] = set()

        for query in queries:
            if len(extracted) >= max_results:
                break
                
            limit = max_results // len(queries)
            results = search_ddg(
                query=query,
                max_results=limit,
                pages=1,
                excluded_domains=DEFAULT_EXCLUDED_DOMAINS,
                extract_phones=True,
            )
            
            for r in results:
                if r.domain and r.domain not in seen_domains:
                    seen_domains.add(r.domain)
                    rec = DiscoveryRecord(
                        business_name=r.title or "Unknown",
                        source=self.name,
                        website=r.url,
                        phone=r.phone,
                        category=keyword,
                        raw_data={"snippet": r.snippet},
                    )
                    rec.quality_score = 40 + (20 if rec.phone else 0)
                    extracted.append(rec)

        logger.info(f"[website_discovery] {len(extracted)} results across {len(queries)} queries")
        return extracted[:max_results]
