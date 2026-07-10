"""
indiamart_rss.py — Tier 2 IndiaMART RSS/search source.

Queries IndiaMART's search endpoint and parses the HTML results.
Falls back to DuckDuckGo dork for Google-indexed IndiaMART listings.
No Playwright needed — uses requests + BeautifulSoup only.
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


class IndiaMARTRSSSource(BaseDiscoverySource):
    name = "indiamart_rss"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []

        # Primary: IndiaMART search page
        primary = self._search_indiamart(keyword, city, max_results)
        extracted.extend(primary)

        # Fallback: Google-indexed IndiaMART pages via DuckDuckGo
        if len(extracted) < max_results // 2:
            dork_results = self._dork_indiamart(keyword, city, max_results)
            seen = {r.business_name.lower() for r in extracted}
            for rec in dork_results:
                if rec.business_name.lower() not in seen:
                    extracted.append(rec)
                    seen.add(rec.business_name.lower())

        logger.info(f"[indiamart_rss] {len(extracted)} results")
        return extracted[:max_results]

    def _search_indiamart(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            query = urllib.parse.quote(f"{keyword} {city}")
            url = f"https://www.indiamart.com/search.mp?ss={query}"
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Accept-Language": "en-IN,en;q=0.9",
                "Referer": "https://www.indiamart.com/",
            }
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                return records

            soup = BeautifulSoup(resp.text, "html.parser")

            # IndiaMART listing cards
            cards = soup.find_all("div", class_=re.compile(r"(listing|dealer|supplier)", re.I))
            for card in cards[:max_results]:
                name_el = card.find(["h2", "h3", "a"], class_=re.compile(r"(company|name|title)", re.I))
                name = name_el.get_text(strip=True) if name_el else None
                if not name:
                    continue

                phone_el = card.find(text=re.compile(r"\+91|\d{10}"))
                phone = phone_el.strip() if phone_el else None

                addr_el = card.find(class_=re.compile(r"(address|location|city)", re.I))
                address = addr_el.get_text(strip=True) if addr_el else None

                link_el = card.find("a", href=True)
                website = link_el.get("href") if link_el else None
                if website and not website.startswith("http"):
                    website = "https://www.indiamart.com" + website

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                    address=address,
                    raw_data={"indiamart_url": website},
                )
                rec.quality_score = 15 + (20 if phone else 0) + (5 if address else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[indiamart_rss] Search failed: {exc}")
        return records

    def _dork_indiamart(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            query = urllib.parse.quote(f'site:indiamart.com "{keyword}" "{city}"')
            url = f"https://html.duckduckgo.com/html/?q={query}"
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            for result in soup.find_all("div", class_="result")[:max_results]:
                title_el = result.find("a", class_="result__title")
                title = title_el.get_text(strip=True) if title_el else ""
                name = re.split(r"[|\-–]", title)[0].strip()
                if name:
                    rec = DiscoveryRecord(
                        business_name=name,
                        source=self.name,
                        raw_data={"via": "dork"},
                    )
                    rec.quality_score = 10
                    records.append(rec)
        except Exception as exc:
            logger.debug(f"[indiamart_rss] Dork fallback failed: {exc}")
        return records
