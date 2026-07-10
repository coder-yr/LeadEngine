"""
yellowpages.py — Tier 3 YellowPages India scraper.

Parses yellowpages.in and falls back to DuckDuckGo dork search.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import List

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent
from discovery.sources.ddg_parser import dork_search

logger = logging.getLogger(__name__)


class YellowPagesSource(BaseDiscoverySource):
    name = "yellowpages"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted = self._direct_search(keyword, city, max_results)
        
        if len(extracted) < max_results // 3:
            logger.info(f"[yellowpages] Direct search yielded {len(extracted)}, trying dork fallback")
            dork_results = dork_search(
                site="yellowpages.in",
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
                        raw_data={"yellowpages_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 10 + (20 if dr.phone else 0)
                    extracted.append(rec)
                    
        return extracted[:max_results]

    def _direct_search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        city_slug = urllib.parse.quote(city.lower().replace(" ", "-"))
        kw_slug = urllib.parse.quote(keyword.lower().replace(" ", "-"))
        
        for page in range(1, 3):
            if len(records) >= max_results:
                break
                
            try:
                # yellowpages.in usually formats as /search/{city}/{keyword} or /{city}/{keyword}
                url = f"https://www.yellowpages.in/{city_slug}/{kw_slug}"
                if page > 1:
                    url += f"?page={page}"
                    
                headers = {
                    "User-Agent": random_user_agent(),
                    "Accept": "text/html",
                }
                resp = requests.get(url, headers=headers, timeout=12)
                
                # If first URL format fails, try the alternative
                if resp.status_code == 404 and page == 1:
                    url = f"https://www.yellowpages.in/search/{city_slug}/{kw_slug}"
                    resp = requests.get(url, headers=headers, timeout=12)
                    
                if resp.status_code != 200:
                    break

                soup = BeautifulSoup(resp.text, "html.parser")
                listings = soup.find_all("div", class_="listing-item")
                if not listings:
                    listings = soup.find_all("div", class_="biz-listing")
                    
                if not listings:
                    break
                
                for listing in listings:
                    if len(records) >= max_results:
                        break
                        
                    name_el = listing.find("h2", class_="listing-name") or listing.find("a", class_="biz-name")
                    if not name_el:
                        continue
                        
                    name = name_el.get_text(strip=True)
                    if not name:
                        continue

                    # Website might be available directly in YP
                    website = None
                    web_el = listing.find("a", class_="listing-website")
                    if web_el and web_el.get("href"):
                        website = web_el["href"]

                    rec = DiscoveryRecord(
                        business_name=name,
                        source=self.name,
                        website=website,
                    )
                    rec.quality_score = 10 + (20 if website else 0)
                    records.append(rec)

            except Exception as exc:
                logger.debug(f"[yellowpages] Page {page} failed: {exc}")
                break
                
        return records
