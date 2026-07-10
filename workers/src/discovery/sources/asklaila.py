"""
asklaila.py — Tier 3 AskLaila scraper.

Queries the AskLaila search page and parses the results.
Falls back to DuckDuckGo dork search if direct parsing fails.
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


class AskLailaSource(BaseDiscoverySource):
    name = "asklaila"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted = self._direct_search(keyword, city, max_results)
        
        # If direct search yields little/nothing, fallback to dork
        if len(extracted) < max_results // 3:
            logger.info(f"[asklaila] Direct search yielded {len(extracted)}, trying dork fallback")
            dork_results = dork_search(
                site="asklaila.com",
                keyword=keyword,
                city=city,
                max_results=max_results - len(extracted)
            )
            
            seen_names = {r.business_name.lower() for r in extracted}
            for dr in dork_results:
                if dr.title and dr.title.lower() not in seen_names:
                    seen_names.add(dr.title.lower())
                    rec = DiscoveryRecord(
                        business_name=dr.title,
                        source=self.name,
                        phone=dr.phone,
                        raw_data={"asklaila_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 10 + (20 if dr.phone else 0)
                    extracted.append(rec)
                    
        return extracted[:max_results]

    def _direct_search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            city_slug = urllib.parse.quote(city.lower().replace(" ", "-"))
            kw_slug = urllib.parse.quote(keyword.lower().replace(" ", "-"))
            url = f"https://www.asklaila.com/search/{city_slug}/{kw_slug}/"
            
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Referer": "https://www.asklaila.com/"
            }
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code != 200:
                return records

            soup = BeautifulSoup(resp.text, "html.parser")
            
            # AskLaila listing structure
            listings = soup.find_all("div", class_=re.compile(r"search-result|listing-info|srp"))
            
            for listing in listings[:max_results]:
                name_el = listing.find("h2") or listing.find("a", class_="resultTitle")
                if not name_el:
                    continue
                    
                name = name_el.get_text(strip=True)
                if not name:
                    continue

                phone_el = listing.find("label", class_=re.compile(r"ph|phone|contact"))
                phone = phone_el.get_text(strip=True) if phone_el else None
                
                addr_el = listing.find("div", class_="address")
                address = addr_el.get_text(strip=True) if addr_el else None
                
                # Check for website link
                website = None
                links = listing.find_all("a", href=True)
                for a in links:
                    href = a.get("href", "")
                    if href.startswith("http") and "asklaila" not in href:
                        website = href
                        break

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                    address=address,
                    website=website,
                )
                rec.quality_score = 10 + (10 if phone else 0) + (5 if address else 0) + (10 if website else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[asklaila] Direct search failed: {exc}")
            
        return records
