"""
yellowpages.py — Tier 3 Yellow Pages India source (migrated from yellowpages_scraper.py).
Optional — 10s timeout, failure silently skipped.
"""

from __future__ import annotations

import logging
import re
from typing import List

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent

logger = logging.getLogger(__name__)


class YellowPagesSource(BaseDiscoverySource):
    name = "yellowpages"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []
        slug_kw = keyword.lower().replace(" ", "-")
        slug_city = city.lower().replace(" ", "-")
        url = f"https://www.yellowpages.in/{slug_city}/{slug_kw}"

        try:
            headers = {"User-Agent": random_user_agent(), "Accept": "text/html"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "html.parser")
            listings = soup.find_all(class_=re.compile(r"(listing|result|company)", re.I))

            for item in listings[:max_results]:
                name_el = item.find(["h2", "h3", "a", "strong"])
                name = name_el.get_text(strip=True) if name_el else None
                if not name:
                    continue

                phone_match = re.search(r"(\+91[\-\s]?\d{10}|\d{10}|\d{5}[\s-]\d{5})", str(item))
                phone = phone_match.group(0).replace(" ", "").replace("-", "") if phone_match else None

                addr_el = item.find(class_=re.compile(r"(addr|address|location)", re.I))
                address = addr_el.get_text(strip=True) if addr_el else None

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                    address=address,
                )
                rec.quality_score = 5 + (15 if phone else 0) + (5 if address else 0)
                extracted.append(rec)

            logger.info(f"[yellowpages] {len(extracted)} results")
        except Exception as exc:
            logger.debug(f"[yellowpages] Failed: {exc}")

        return extracted
