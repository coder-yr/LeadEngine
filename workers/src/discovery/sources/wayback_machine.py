"""
wayback_machine.py — Tier 2 Wayback Machine / Internet Archive source.

Uses the CDX API to find archived business websites.
Useful as a fallback when a company's current website is down.
Also used to enrich results when other sources provide a company name
but the website is unreachable.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import List

import requests

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent

logger = logging.getLogger(__name__)

CDX_API = "http://web.archive.org/cdx/search/cdx"
AVAILABLE_API = "https://archive.org/wayback/available"


class WaybackMachineSource(BaseDiscoverySource):
    name = "wayback_machine"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        """
        Search for archived business websites matching keyword + city.
        Uses CDX API to find snapshots of relevant domains.
        """
        extracted: List[DiscoveryRecord] = []

        # Strategy: Search for common Indian business domain patterns
        # matching the keyword/city
        search_patterns = [
            f"{keyword.lower().replace(' ', '')}{city.lower().replace(' ', '')}",
            f"{keyword.lower().replace(' ', '-')}-{city.lower().replace(' ', '-')}",
            f"{city.lower().replace(' ', '')}{keyword.lower().replace(' ', '')}",
        ]

        for pattern in search_patterns:
            if len(extracted) >= max_results:
                break
            records = self._cdx_search(pattern, keyword, max_results)
            seen = {r.website for r in extracted}
            for rec in records:
                if rec.website not in seen:
                    extracted.append(rec)
                    seen.add(rec.website)

        logger.info(f"[wayback_machine] {len(extracted)} archived sites found")
        return extracted[:max_results]

    def _cdx_search(self, pattern: str, keyword: str, limit: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            params = {
                "url": f"*.{pattern}.in",
                "output": "json",
                "fl": "original,timestamp,statuscode",
                "filter": "statuscode:200",
                "collapse": "urlkey",
                "limit": str(limit),
            }
            headers = {"User-Agent": "LeadEngine/2.0 (contact@leadengine.app)"}
            resp = requests.get(CDX_API, params=params, headers=headers, timeout=15)

            if resp.status_code != 200:
                return records

            data = resp.json()
            if not data or len(data) < 2:
                return records

            # First row is header
            for row in data[1:limit + 1]:
                original_url = row[0] if len(row) > 0 else None
                if not original_url:
                    continue

                # Extract domain as business name
                try:
                    domain = urllib.parse.urlparse(
                        original_url if original_url.startswith("http") else f"https://{original_url}"
                    ).netloc.lstrip("www.")
                    name = domain.split(".")[0].replace("-", " ").title()
                except Exception:
                    continue

                # Get wayback URL for this snapshot
                archived_url = f"https://web.archive.org/web/{row[1]}/{original_url}"

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    website=f"https://{domain}" if not original_url.startswith("http") else original_url,
                    raw_data={
                        "archived_url": archived_url,
                        "snapshot_timestamp": row[1] if len(row) > 1 else None,
                        "keyword": keyword,
                    },
                )
                rec.quality_score = 15 + (25 if rec.website else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[wayback_machine] CDX search failed: {exc}")

        return records
