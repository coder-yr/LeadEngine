"""
tradeindia.py — Tier 3 TradeIndia B2B directory source (stub).
Optional — 10s timeout, failure silently skipped.
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


class TradeIndiaSource(BaseDiscoverySource):
    name = "tradeindia"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []

        # Use DuckDuckGo dork for TradeIndia
        query = urllib.parse.quote(f'site:tradeindia.com "{keyword}" "{city}"')
        url = f"https://html.duckduckgo.com/html/?q={query}"

        try:
            headers = {"User-Agent": random_user_agent(), "Accept": "text/html"}
            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            for result in soup.find_all("div", class_="result")[:max_results]:
                title_el = result.find("a", class_="result__title")
                title = title_el.get_text(strip=True) if title_el else ""
                name = re.split(r"[|\-–]", title)[0].strip()

                if not name:
                    continue

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    raw_data={"via": "dork"},
                )
                rec.quality_score = 5
                extracted.append(rec)

            logger.info(f"[tradeindia] {len(extracted)} results")
        except Exception as exc:
            logger.debug(f"[tradeindia] Failed: {exc}")

        return extracted
