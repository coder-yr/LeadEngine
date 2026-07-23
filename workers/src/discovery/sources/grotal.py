"""
grotal.py — Tier 3 Grotal scraper.

Queries the Grotal search page with pagination.
Falls back to DuckDuckGo dork search.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import List

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent
from discovery.sources.ddg_parser import dork_search

logger = logging.getLogger(__name__)


class GrotalSource(BaseDiscoverySource):
    name = "grotal"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted = self._direct_search(keyword, city, max_results)
        
        if len(extracted) < max_results // 3:
            logger.info(f"[grotal] Direct search yielded {len(extracted)}, trying dork fallback")
            dork_results = dork_search(
                site="grotal.com",
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
                        raw_data={"grotal_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 10 + (20 if dr.phone else 0)
                    extracted.append(rec)
                    
        return extracted[:max_results]

    def _direct_search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        city_slug = urllib.parse.quote(city.replace(" ", ""))
        kw_slug = urllib.parse.quote(keyword.replace(" ", ""))
        
        # Grotal often paginates
        for page in range(1, 4):
            if len(records) >= max_results:
                break
                
            try:
                url = f"https://www.grotal.com/{city_slug}/{kw_slug}/"
                if page > 1:
                    url += f"?page={page}"
                    
                headers = {
                    "User-Agent": random_user_agent(),
                    "Accept": "text/html",
                }
                resp = requests.get(url, headers=headers, timeout=12, verify=False)
                if resp.status_code != 200:
                    break

                soup = BeautifulSoup(resp.text, "html.parser")
                listings = soup.find_all("div", class_="listingBox")
                if not listings:
                    listings = soup.find_all("div", class_="customer-details")
                    
                if not listings:
                    break
                
                for listing in listings:
                    if len(records) >= max_results:
                        break
                        
                    name_el = listing.find("div", class_="company-name") or listing.find("h2")
                    if not name_el:
                        continue
                        
                    name = name_el.get_text(strip=True)
                    if not name:
                        continue

                    phone_el = listing.find("span", class_="phn_no") or listing.find(text=lambda t: t and t.strip().startswith("+91"))
                    phone = phone_el.get_text(strip=True) if hasattr(phone_el, 'get_text') else (phone_el.strip() if phone_el else None)
                    
                    addr_el = listing.find("div", class_="address")
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
                logger.debug(f"[grotal] Page {page} failed: {exc}")
                break
                
        return records
