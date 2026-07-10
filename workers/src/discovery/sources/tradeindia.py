"""
tradeindia.py — Tier 3 TradeIndia scraper.

Parses tradeindia.com and falls back to DuckDuckGo dork search.
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


class TradeIndiaSource(BaseDiscoverySource):
    name = "tradeindia"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted = self._direct_search(keyword, city, max_results)
        
        if len(extracted) < max_results // 3:
            logger.info(f"[tradeindia] Direct search yielded {len(extracted)}, trying dork fallback")
            dork_results = dork_search(
                site="tradeindia.com",
                keyword=keyword,
                city=city,
                max_results=max_results - len(extracted)
            )
            
            seen_names = {r.business_name.lower() for r in extracted}
            for dr in dork_results:
                if dr.title and dr.title.lower() not in seen_names:
                    seen_names.add(dr.title.lower())
                    
                    # Clean title: usually "Supplier Name in City, State - TradeIndia"
                    clean_name = re.split(r" in ", dr.title)[0].strip()
                    
                    rec = DiscoveryRecord(
                        business_name=clean_name or dr.title,
                        source=self.name,
                        phone=dr.phone,
                        raw_data={"tradeindia_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 10 + (20 if dr.phone else 0)
                    extracted.append(rec)
                    
        return extracted[:max_results]

    def _direct_search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            query = urllib.parse.quote_plus(f"{keyword} {city}")
            url = f"https://www.tradeindia.com/search.html?search={query}"
            
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Referer": "https://www.tradeindia.com/"
            }
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code != 200:
                return records

            soup = BeautifulSoup(resp.text, "html.parser")
            listings = soup.find_all("div", class_=re.compile(r"product-card|company-card|listing-box"))
            
            for listing in listings[:max_results]:
                name_el = listing.find("h2") or listing.find("a", class_=re.compile(r"company|name|title"))
                if not name_el:
                    continue
                    
                name = name_el.get_text(strip=True)
                if not name:
                    continue
                    
                phone_el = listing.find(text=re.compile(r"\+91[-\s]?\d{10}"))
                phone = phone_el.strip() if phone_el else None
                
                addr_el = listing.find("div", class_=re.compile(r"location|address|city"))
                address = addr_el.get_text(strip=True) if addr_el else None

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                    address=address,
                )
                rec.quality_score = 10 + (10 if phone else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[tradeindia] Direct search failed: {exc}")
            
        return records
