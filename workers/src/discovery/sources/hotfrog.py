"""
hotfrog.py — Tier 3 Hotfrog scraper.

Parses hotfrog.in and falls back to DuckDuckGo dork search.
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


class HotfrogSource(BaseDiscoverySource):
    name = "hotfrog"
    tier = 3
    reliability_stars = 2

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted = self._direct_search(keyword, city, max_results)
        
        if len(extracted) < max_results // 3:
            logger.info(f"[hotfrog] Direct search yielded {len(extracted)}, trying dork fallback")
            dork_results = dork_search(
                site="hotfrog.in",
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
                        raw_data={"hotfrog_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 10 + (20 if dr.phone else 0)
                    extracted.append(rec)
                    
        return extracted[:max_results]

    def _direct_search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            city_slug = urllib.parse.quote(city.lower().replace(" ", "-"))
            kw_slug = urllib.parse.quote(keyword.lower().replace(" ", "-"))
            
            # Hotfrog typically uses this structure:
            url = f"https://www.hotfrog.in/search/{kw_slug}/{city_slug}"
            
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
            }
            resp = requests.get(url, headers=headers, timeout=12, verify=False)
            
            if resp.status_code == 404:
                # Alternate URL format
                url = f"https://www.hotfrog.in/companies/{kw_slug}-{city_slug}"
                resp = requests.get(url, headers=headers, timeout=12, verify=False)
                
            if resp.status_code != 200:
                return records

            soup = BeautifulSoup(resp.text, "html.parser")
            listings = soup.find_all("div", class_="listing-card") or soup.find_all("div", class_="business-result")
            
            for listing in listings[:max_results]:
                name_el = listing.find("h3", class_="listing-title") or listing.find("a", class_="biz-name")
                if not name_el:
                    continue
                    
                name = name_el.get_text(strip=True)
                if not name:
                    continue

                phone_el = listing.find("a", href=lambda h: h and h.startswith("tel:"))
                phone = None
                if phone_el:
                    phone = phone_el["href"].replace("tel:", "").strip()

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    phone=phone,
                )
                rec.quality_score = 10 + (10 if phone else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[hotfrog] Direct search failed: {exc}")
            
        return records
