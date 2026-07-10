"""
zauba_corp.py — Tier 2 Zauba Corp company registry source.

Searches zaubacorp.com for Indian registered companies.
Falls back to Wayback Machine if Cloudflare blocks direct access.
Returns company name, CIN, address, and registration status.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import List, Optional

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent, wayback_fallback

logger = logging.getLogger(__name__)

ZAUBA_SEARCH_URL = "https://www.zaubacorp.com/company-search/q-{query}/p-1"


class ZaubaCorpSource(BaseDiscoverySource):
    name = "zauba_corp"
    tier = 2
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        query = urllib.parse.quote(f"{keyword} {city}")
        url = ZAUBA_SEARCH_URL.format(query=query)
        extracted: List[DiscoveryRecord] = []

        html = self._fetch(url)
        if not html:
            # Try wayback fallback
            html = wayback_fallback(url)

        if not html:
            logger.warning(f"[zauba_corp] Could not fetch search results")
            return []

        try:
            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table", {"id": "tablesaw"}) or soup.find("table")
            if not table:
                logger.warning("[zauba_corp] No results table found")
                return []

            rows = table.find_all("tr")[1:]  # Skip header
            for row in rows[:max_results]:
                cells = row.find_all("td")
                if len(cells) < 3:
                    continue

                company_link = cells[0].find("a")
                name = company_link.get_text(strip=True) if company_link else cells[0].get_text(strip=True)
                cin = cells[1].get_text(strip=True) if len(cells) > 1 else None
                address = cells[2].get_text(strip=True) if len(cells) > 2 else None
                status = cells[3].get_text(strip=True) if len(cells) > 3 else None

                if not name:
                    continue

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    address=address,
                    cin=cin,
                    raw_data={
                        "cin": cin,
                        "status": status,
                        "zauba_url": company_link.get("href", "") if company_link else "",
                    },
                )
                rec.quality_score = 30 + (10 if cin else 0) + (5 if address else 0)
                extracted.append(rec)

            logger.info(f"[zauba_corp] {len(extracted)} companies found")
        except Exception as exc:
            logger.error(f"[zauba_corp] Parse error: {exc}")

        return extracted

    def _fetch(self, url: str) -> Optional[str]:
        try:
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Accept-Language": "en-IN,en;q=0.9",
            }
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200:
                return resp.text
            logger.warning(f"[zauba_corp] HTTP {resp.status_code} for {url}")
        except Exception as exc:
            logger.debug(f"[zauba_corp] Fetch failed: {exc}")
        return None
