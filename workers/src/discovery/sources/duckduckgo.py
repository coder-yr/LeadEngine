"""
duckduckgo.py — Tier 1 DuckDuckGo HTML scraper.

Uses the shared ddg_parser for consistent URL extraction, domain filtering,
and phone number discovery. Supports multi-page results.
"""

from __future__ import annotations

import logging
from typing import List

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.sources.ddg_parser import search_ddg, DEFAULT_EXCLUDED_DOMAINS

logger = logging.getLogger(__name__)


class DuckDuckGoSource(BaseDiscoverySource):
    name = "duckduckgo"
    tier = 1
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        # Build targeted query excluding directory sites
        top_excludes = [
            "justdial.com", "practo.com", "sulekha.com", "yellowpages.in",
            "asklaila.com", "grotal.com", "facebook.com", "linkedin.com",
        ]
        query = f"{keyword} {city} official website"
        for ex in top_excludes:
            query += f" -site:{ex}"

        # Fetch 1-3 pages depending on how many results we need
        pages = min(3, (max_results // 20) + 1)

        ddg_results = search_ddg(
            query=query,
            max_results=max_results,
            pages=pages,
            excluded_domains=DEFAULT_EXCLUDED_DOMAINS,
            extract_phones=True,
        )

        extracted: List[DiscoveryRecord] = []
        for r in ddg_results:
            rec = DiscoveryRecord(
                business_name=r.title,
                source=self.name,
                website=r.url,
                phone=r.phone,
                category=keyword,
                raw_data={"snippet": r.snippet},
            )
            rec.quality_score = 10 + (40 if rec.website else 0) + (20 if rec.phone else 0)
            extracted.append(rec)

        logger.info(f"[duckduckgo] {len(extracted)} results ({pages} page(s))")
        return extracted
