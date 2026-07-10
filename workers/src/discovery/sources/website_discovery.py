"""
website_discovery.py — Tier 1 Company Website Discovery source.

Migrated from website_search_scraper.py.
Searches DuckDuckGo for direct company websites using a targeted query,
then validates each result to ensure it's a real company domain.
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

EXCLUDED = {
    "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
    "justdial.com", "sulekha.com", "indiamart.com", "tradeindia.com",
    "wikipedia.org", "glassdoor.com", "naukri.com", "quora.com", "reddit.com",
    "youtube.com", "grotal.com", "asklaila.com", "hotfrog.com", "yellowpages.in",
    "practo.com", "lybrate.com", "magicbricks.com", "99acres.com",
}


def _valid(url: str) -> bool:
    try:
        d = urllib.parse.urlparse(
            url if url.startswith("http") else f"https://{url}"
        ).netloc.lower().lstrip("www.")
        if not d:
            return False
        if d.endswith(".gov") or d.endswith(".gov.in") or d.endswith(".nic.in"):
            return False
        for ex in EXCLUDED:
            if d == ex or d.endswith(f".{ex}"):
                return False
        return True
    except Exception:
        return False


class WebsiteDiscoverySource(BaseDiscoverySource):
    name = "website_discovery"
    tier = 1
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        query = f"{keyword} {city} official website"
        encoded = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        extracted: List[DiscoveryRecord] = []

        try:
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Referer": "https://duckduckgo.com/",
            }
            resp = requests.get(url, headers=headers, timeout=12)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            for result in soup.find_all("div", class_="result"):
                if len(extracted) >= max_results:
                    break

                url_el = result.find("a", class_="result__url")
                if not url_el:
                    continue
                href = url_el.get("href", "")
                if "uddg=" in href:
                    try:
                        href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
                    except Exception:
                        pass

                if not _valid(href):
                    continue

                title_el = result.find("a", class_="result__title")
                title = title_el.get_text(strip=True) if title_el else ""
                clean = re.split(r"[|\-–]", title)[0].strip()

                snippet_el = result.find("div", class_="result__snippet")
                snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                rec = DiscoveryRecord(
                    business_name=clean or "Unknown",
                    source=self.name,
                    website=href,
                    category=keyword,
                    raw_data={"snippet": snippet[:200]},
                )
                rec.quality_score = 40
                extracted.append(rec)

            logger.info(f"[website_discovery] {len(extracted)} results for '{keyword} {city}'")
        except Exception as exc:
            logger.error(f"[website_discovery] Failed: {exc}")

        return extracted
