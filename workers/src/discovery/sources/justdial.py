"""
justdial.py — Tier 3 JustDial source (migrated from free_contact_discovery_v3.py).
Optional — 10s timeout, failure silently skipped.
Uses DuckDuckGo dork fallback as JustDial blocks direct scraping.
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


class JustDialSource(BaseDiscoverySource):
    name = "justdial"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []

        # JustDial blocks direct scraping — use Google-indexed results via DuckDuckGo
        query = urllib.parse.quote(f'site:justdial.com "{keyword}" "{city}"')
        url = f"https://html.duckduckgo.com/html/?q={query}"

        try:
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Referer": "https://duckduckgo.com/",
            }
            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            for result in soup.find_all("div", class_="result")[:max_results]:
                title_el = result.find("a", class_="result__title")
                snippet_el = result.find("div", class_="result__snippet")

                title = title_el.get_text(strip=True) if title_el else ""
                snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                name = re.split(r"[|\-–]", title)[0].strip()
                if not name or name.lower() == "justdial":
                    continue

                phone_match = re.search(r"\+91[\s-]?\d{10}|\d{10}", snippet)
                phone = phone_match.group(0) if phone_match else None

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                    raw_data={"snippet": snippet[:200], "via": "dork"},
                )
                rec.quality_score = 5 + (15 if phone else 0)
                extracted.append(rec)

            logger.info(f"[justdial] {len(extracted)} results via dork")
        except Exception as exc:
            logger.debug(f"[justdial] Failed: {exc}")

        return extracted
