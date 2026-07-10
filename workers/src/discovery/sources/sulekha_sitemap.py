"""
sulekha_sitemap.py — Tier 2 Sulekha sitemap parser.

Parses Sulekha XML sitemaps to extract business listings by city and keyword.
Sitemap index: https://www.sulekha.com/sitemap_index.xml
No scraping of rendered pages — pure XML parsing.
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from typing import List, Optional

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent

logger = logging.getLogger(__name__)

SITEMAP_INDEX = "https://www.sulekha.com/sitemap_index.xml"


class SulekhaSitemapSource(BaseDiscoverySource):
    name = "sulekha_sitemap"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []

        # Find relevant sitemaps from index
        sitemap_urls = self._get_relevant_sitemaps(keyword, city)

        for sm_url in sitemap_urls[:3]:  # Check up to 3 relevant sitemaps
            if len(extracted) >= max_results:
                break
            records = self._parse_sitemap(sm_url, keyword, city, max_results)
            extracted.extend(records)

        # Fallback: DuckDuckGo dork on sulekha.com
        if not extracted:
            extracted = self._dork_sulekha(keyword, city, max_results)

        logger.info(f"[sulekha_sitemap] {len(extracted)} results")
        return extracted[:max_results]

    def _get_relevant_sitemaps(self, keyword: str, city: str) -> List[str]:
        """Parse sitemap index and find URLs matching keyword/city."""
        sitemaps: List[str] = []
        try:
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(SITEMAP_INDEX, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "xml")
            kw_slug = re.sub(r"\s+", "-", keyword.lower().strip())
            city_slug = re.sub(r"\s+", "-", city.lower().strip())

            for loc in soup.find_all("loc"):
                url = loc.get_text(strip=True)
                url_lower = url.lower()
                if kw_slug in url_lower or city_slug in url_lower:
                    sitemaps.append(url)
                if len(sitemaps) >= 5:
                    break

        except Exception as exc:
            logger.debug(f"[sulekha_sitemap] Sitemap index failed: {exc}")

        return sitemaps

    def _parse_sitemap(
        self, sitemap_url: str, keyword: str, city: str, max_results: int
    ) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(sitemap_url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "xml")
            city_lower = city.lower()
            kw_lower = keyword.lower()

            for url_tag in soup.find_all("url"):
                if len(records) >= max_results:
                    break

                loc = url_tag.find("loc")
                if not loc:
                    continue

                page_url = loc.get_text(strip=True).lower()
                if city_lower not in page_url and kw_lower not in page_url:
                    continue

                # Extract business name from URL slug
                # e.g., sulekha.com/dentist/mumbai/dr-abc-dental-clinic-123456
                parts = page_url.rstrip("/").split("/")
                slug = parts[-1] if parts else ""
                # Remove trailing ID numbers
                slug = re.sub(r"-\d+$", "", slug)
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

    def _dork_sulekha(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            query = urllib.parse.quote(f'site:sulekha.com "{keyword}" "{city}"')
            url = f"https://html.duckduckgo.com/html/?q={query}"
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            for result in soup.find_all("div", class_="result")[:max_results]:
                title_el = result.find("a", class_="result__title")
                title = title_el.get_text(strip=True) if title_el else ""
                name = re.split(r"[|\-–]", title)[0].strip()
                if name:
                    rec = DiscoveryRecord(business_name=name, source=self.name)
                    rec.quality_score = 10
                    records.append(rec)
        except Exception as exc:
            logger.debug(f"[sulekha_sitemap] Dork fallback failed: {exc}")
        return records
