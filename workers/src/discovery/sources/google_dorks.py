"""
google_dorks.py — Tier 1 Google Dork search via DuckDuckGo HTML.

Constructs targeted dork queries to find company websites, avoiding
directories and social platforms. Uses the shared ddg_parser for
consistent extraction.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import List, Set

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.sources.ddg_parser import search_ddg, DEFAULT_EXCLUDED_DOMAINS

logger = logging.getLogger(__name__)


def _build_dork_queries(keyword: str, city: str) -> List[str]:
    # We don't need to add -site: exclusions here because the ddg_parser
    # already filters out bad domains from the results.
    # We keep the queries simple and targeted.
    return [
        f'"{keyword}" "{city}" site:*.in OR site:*.com',
        f'"contact us" "{keyword}" "{city}"',
        f'"about us" "{keyword}" "{city}"',
        f'"services" "{keyword}" "{city}"',
        f'inurl:contact "{keyword}" "{city}"',
    ]


class GoogleDorksSource(BaseDiscoverySource):
    name = "google_dorks"
    tier = 1
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        queries = _build_dork_queries(keyword, city)
        extracted: List[DiscoveryRecord] = []
        seen_domains: Set[str] = set()

        for query in queries:
            if len(extracted) >= max_results:
                break
                
            limit_per_query = max(10, max_results // len(queries))
            results = search_ddg(
                query=query,
                max_results=limit_per_query,
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
                        raw_data={"snippet": r.snippet},
                    )
                    rec.quality_score = 35 + (20 if rec.phone else 0)
                    extracted.append(rec)

        logger.info(f"[google_dorks] {len(extracted)} results across {len(queries)} queries")
        return extracted[:max_results]
