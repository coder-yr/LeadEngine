"""
sulekha_sitemap.py — Tier 2 Sulekha sitemap parser.

Parses Sulekha XML sitemaps to extract business listings by city and keyword.
Sitemap index: https://www.sulekha.com/sitemap_index.xml
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from typing import List, Set

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent
from discovery.sources.ddg_parser import dork_search

logger = logging.getLogger(__name__)

SITEMAP_INDEX = "https://www.sulekha.com/sitemap_index.xml"

# Map common cities to Sulekha's naming if different
CITY_ALIASES = {
    "mumbai": ["mumbai", "bombay"],
    "bengaluru": ["bengaluru", "bangalore"],
    "bangalore": ["bangalore", "bengaluru"],
    "chennai": ["chennai", "madras"],
    "kolkata": ["kolkata", "calcutta"],
    "gurugram": ["gurugram", "gurgaon"],
}


class SulekhaSitemapSource(BaseDiscoverySource):
    name = "sulekha_sitemap"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []
        seen_names: Set[str] = set()
        
        aliases = CITY_ALIASES.get(city.lower(), [city.lower()])

        # Find relevant sitemaps from index for all city aliases
        sitemap_urls = self._get_relevant_sitemaps(keyword, aliases)

        for sm_url in sitemap_urls[:3]:  # Check up to 3 relevant sitemaps
            if len(extracted) >= max_results:
                break
            records = self._parse_sitemap(sm_url, keyword, aliases, max_results)
            
            for rec in records:
                if rec.business_name.lower() not in seen_names:
                    seen_names.add(rec.business_name.lower())
                    extracted.append(rec)

        # Fallback: DuckDuckGo dork on sulekha.com
        if len(extracted) < max_results // 2:
            dork_results = dork_search(
                site="sulekha.com",
                keyword=keyword,
                city=city,
                max_results=max_results - len(extracted)
            )
            for dr in dork_results:
                clean_name = re.split(r"[|\-–]", dr.title)[0].strip()
                if clean_name.lower() not in seen_names:
                    seen_names.add(clean_name.lower())
                    rec = DiscoveryRecord(
                        business_name=clean_name,
                        source=self.name,
                        phone=dr.phone,
                        raw_data={"sulekha_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 10 + (20 if dr.phone else 0)
                    extracted.append(rec)

        logger.info(f"[sulekha_sitemap] {len(extracted)} results")
        return extracted[:max_results]

    def _get_relevant_sitemaps(self, keyword: str, aliases: List[str]) -> List[str]:
        """Parse sitemap index and find URLs matching keyword/city."""
        sitemaps: List[str] = []
        try:
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(SITEMAP_INDEX, headers=headers, timeout=12)
            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "xml")
            kw_slug = re.sub(r"\s+", "-", keyword.lower().strip())
            
            for loc in soup.find_all("loc"):
                url = loc.get_text(strip=True).lower()
                
                # We want sitemaps that have both the keyword and the city (or city alone if general)
                has_city = any(alias in url for alias in aliases)
                has_kw = kw_slug in url
                
                if has_city or has_kw:
                    # Prefer exact matches to front of list
                    if has_city and has_kw:
                        sitemaps.insert(0, loc.get_text(strip=True))
                    else:
                        sitemaps.append(loc.get_text(strip=True))
                        
                if len(sitemaps) >= 10:
                    break

        except Exception as exc:
            logger.debug(f"[sulekha_sitemap] Sitemap index failed: {exc}")

        return sitemaps

    def _parse_sitemap(
        self, sitemap_url: str, keyword: str, aliases: List[str], max_results: int
    ) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(sitemap_url, headers=headers, timeout=15)
            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "xml")
            kw_lower = keyword.lower()

            for url_tag in soup.find_all("url"):
                if len(records) >= max_results:
                    break

                loc = url_tag.find("loc")
                if not loc:
                    continue

                page_url = loc.get_text(strip=True).lower()
                
                has_city = any(alias in page_url for alias in aliases)
                if not has_city and kw_lower not in page_url:
                    continue

                # Extract business name from URL slug
                # e.g., sulekha.com/dr-abc-dental-clinic-mumbai-contact-address
                parts = page_url.rstrip("/").split("/")
                slug = parts[-1] if parts else ""
                
                # Remove common Sulekha URL noise
                slug = re.sub(r"-contact-address$", "", slug)
                slug = re.sub(r"-\d+$", "", slug)
                for alias in aliases:
                    slug = slug.replace(f"-{alias}", "")
                    
                name = slug.replace("-", " ").title()

                if not name or len(name) < 3:
                    continue

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    raw_data={"sulekha_url": loc.get_text(strip=True)},
                )
                rec.quality_score = 15
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[sulekha_sitemap] Parse error for {sitemap_url}: {exc}")
        return records
