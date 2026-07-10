"""
grotal.py — Tier 3 Grotal directory source (migrated from grotal_scraper.py).
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


class GrotalSource(BaseDiscoverySource):
    name = "grotal"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []
        slug_kw = keyword.lower().replace(" ", "-")
        slug_city = city.lower().replace(" ", "-")
        url = f"https://www.grotal.com/{slug_city}/{slug_kw}/"

        try:
            headers = {"User-Agent": random_user_agent(), "Accept": "text/html"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "html.parser")
            listings = soup.find_all("div", class_=re.compile(r"(listing|biz|result)", re.I))

            for item in listings[:max_results]:
                name_el = item.find(["h2", "h3", "a"])
                name = name_el.get_text(strip=True) if name_el else None
                if not name:
                    continue

                phone_el = item.find(text=re.compile(r"\d{10}|\+91"))
                phone = phone_el.strip() if phone_el else None

                addr_el = item.find(class_=re.compile(r"(addr|location)", re.I))
                address = addr_el.get_text(strip=True) if addr_el else None

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                    address=address,
                )
                rec.quality_score = 5 + (15 if phone else 0) + (5 if address else 0)
                extracted.append(rec)

            logger.info(f"[grotal] {len(extracted)} results")
        except Exception as exc:
            logger.debug(f"[grotal] Failed: {exc}")

        return extracted
