"""
hotfrog.py — Tier 3 Hotfrog directory source (migrated from hotfrog_scraper.py).
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


class HotfrogSource(BaseDiscoverySource):
    name = "hotfrog"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []
        query = urllib.parse.quote(keyword)
        loc = urllib.parse.quote(city)
        url = f"https://www.hotfrog.in/search/{query}/{loc}"

        try:
            headers = {"User-Agent": random_user_agent(), "Accept": "text/html"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "html.parser")
            listings = soup.find_all(class_=re.compile(r"(listing|result|biz)", re.I))

            for item in listings[:max_results]:
                name_el = item.find(["h2", "h3", "h4", "a"])
                name = name_el.get_text(strip=True) if name_el else None
                if not name:
                    continue

                phone_match = re.search(r"\+91[\s-]?\d{10}|\d{10}", str(item))
                phone = phone_match.group(0) if phone_match else None

                web_el = item.find("a", href=re.compile(r"https?://(?!hotfrog)"))
                website = web_el.get("href") if web_el else None

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                    website=website,
                )
                rec.quality_score = 5 + (15 if phone else 0) + (20 if website else 0)
                extracted.append(rec)

            logger.info(f"[hotfrog] {len(extracted)} results")
        except Exception as exc:
            logger.debug(f"[hotfrog] Failed: {exc}")

        return extracted
