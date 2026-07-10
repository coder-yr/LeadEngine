"""
gst_lookup.py — Tier 2 GST Registry source.

Uses Google dorks via DuckDuckGo to find GST-registered businesses.
Extracts GSTIN, business name, and principal place of business
from Google-indexed GST search results.
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from typing import List

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent

logger = logging.getLogger(__name__)

GSTIN_PATTERN = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b")


class GSTLookupSource(BaseDiscoverySource):
    name = "gst_lookup"
    tier = 2
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []

        queries = [
            f'site:gst.gov.in "{keyword}" "{city}"',
            f'GSTIN "{keyword}" "{city}" "principal place of business"',
            f'"{keyword}" "{city}" GST registration filetype:html',
        ]

        seen: set = set()

        for query in queries:
            if len(extracted) >= max_results:
                break
            records = self._ddg_search(query, max_results)
            for rec in records:
                key = rec.business_name.lower().strip()
                if key not in seen:
                    seen.add(key)
                    extracted.append(rec)

        logger.info(f"[gst_lookup] {len(extracted)} results for '{keyword} {city}'")
        return extracted[:max_results]

    def _ddg_search(self, query: str, limit: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://html.duckduckgo.com/html/?q={encoded}"
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Referer": "https://duckduckgo.com/",
            }
            resp = requests.get(url, headers=headers, timeout=12)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            for result in soup.find_all("div", class_="result")[:limit]:
                title_el = result.find("a", class_="result__title")
                snippet_el = result.find("div", class_="result__snippet")

                title = title_el.get_text(strip=True) if title_el else ""
                snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                combined = f"{title} {snippet}"

                # Extract GSTIN if present
                gstin_matches = GSTIN_PATTERN.findall(combined)
                gstin = gstin_matches[0] if gstin_matches else None

                # Clean company name from title
                name = re.split(r"[|\-–]", title)[0].strip()
                if not name or len(name) < 3:
                    continue

                # Extract address snippet
                address = None
                addr_match = re.search(
                    r"principal place of business[:\s]+([^,\.]+(?:,\s*[^,\.]+){1,3})",
                    snippet,
                    re.IGNORECASE,
                )
                if addr_match:
                    address = addr_match.group(1).strip()

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    address=address,
                    gstin=gstin,
                    raw_data={
                        "gstin": gstin,
                        "snippet": snippet[:300],
                    },
                )
                rec.quality_score = 20 + (20 if gstin else 0) + (5 if address else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[gst_lookup] DDG search failed: {exc}")

        return records
