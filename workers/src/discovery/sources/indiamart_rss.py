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
from discovery.sources.ddg_parser import dork_search

logger = logging.getLogger(__name__)

# IndiaMART category mapping to improve search hit rate
CATEGORY_MAPPING = {
    "dentist": "dental equipment",
    "doctor": "medical equipment",
    "hospital": "hospital equipment",
    "restaurant": "restaurant equipment",
    "architect": "architectural services",
}


class IndiaMARTRSSSource(BaseDiscoverySource):
    name = "indiamart_rss"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted = self._search_indiamart(keyword, city, max_results)

        if len(extracted) < max_results // 2:
            logger.info(f"[indiamart_rss] Direct search yielded {len(extracted)}, trying dork fallback")
            dork_results = dork_search(
                site="indiamart.com",
                keyword=keyword,
                city=city,
                max_results=max_results - len(extracted)
            )
            
            seen_names = {r.business_name.lower() for r in extracted}
            for dr in dork_results:
                clean_name = self._clean_name(dr.title)
                if clean_name and clean_name.lower() not in seen_names:
                    seen_names.add(clean_name.lower())
                    rec = DiscoveryRecord(
                        business_name=clean_name,
                        source=self.name,
                        phone=dr.phone,
                        raw_data={"indiamart_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 10 + (20 if dr.phone else 0)
                    extracted.append(rec)

        logger.info(f"[indiamart_rss] {len(extracted)} results")
        return extracted[:max_results]

    def _search_indiamart(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            mapped_kw = CATEGORY_MAPPING.get(keyword.lower().strip(), keyword)
            query = urllib.parse.quote(f"{mapped_kw} {city}")
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

            cards = soup.find_all("div", class_=re.compile(r"(listing|dealer|supplier)", re.I))
            for card in cards[:max_results]:
                name_el = card.find(["h2", "h3", "a"], class_=re.compile(r"(company|name|title)", re.I))
                raw_name = name_el.get_text(strip=True) if name_el else None
                name = self._clean_name(raw_name) if raw_name else None
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

    def _clean_name(self, name: str) -> str:
        """Strip IndiaMART suffixes."""
        if not name:
            return ""
        clean = re.split(r"\s+-\s+(Manufacturer|Supplier|Wholesaler|Retailer|Exporter|Importer)", name, flags=re.IGNORECASE)[0]
        clean = re.split(r"\|", clean)[0]
        return clean.strip()
