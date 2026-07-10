"""
duckduckgo.py — Tier 1 DuckDuckGo HTML scraper.
Migrated from duckduckgo_scraper.py.
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

EXCLUDED_DOMAINS = {
    "facebook.com", "instagram.com", "linkedin.com", "youtube.com",
    "twitter.com", "x.com", "justdial.com", "sulekha.com",
    "indiamart.com", "tradeindia.com", "wikipedia.org",
    "glassdoor.com", "naukri.com", "indeed.com", "zoominfo.com",
    "crunchbase.com", "zaubacorp.com", "tofler.in",
    "practo.com", "lybrate.com", "magicbricks.com",
    "grotal.com", "asklaila.com", "hotfrog.in", "hotfrog.com",
    "yellowpages.in", "yellowpages.com",
}


def _is_valid_domain(url: str) -> bool:
    if not url:
        return False
    try:
        parsed = urllib.parse.urlparse(
            url if url.startswith("http") else f"https://{url}"
        )
        domain = parsed.netloc.lower().lstrip("www.")
        if domain.endswith(".gov") or domain.endswith(".gov.in"):
            return False
        for ex in EXCLUDED_DOMAINS:
            if domain == ex or domain.endswith(f".{ex}"):
                return False
        return True
    except Exception:
        return False


class DuckDuckGoSource(BaseDiscoverySource):
    name = "duckduckgo"
    tier = 1
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        top_excludes = [
            "justdial.com", "practo.com", "sulekha.com", "yellowpages.in", 
            "asklaila.com", "grotal.com", "facebook.com", "linkedin.com"
        ]
        query = f"{keyword} {city} official website"
        for ex in top_excludes:
            query += f" -site:{ex}"
            
        encoded = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"

        extracted: List[DiscoveryRecord] = []

        try:
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-IN,en;q=0.9",
                "Referer": "https://duckduckgo.com/",
            }
            resp = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            results = soup.find_all("div", class_="result")

            for result in results:
                if len(extracted) >= max_results:
                    break

                url_el = result.find("a", class_="result__url")
                if not url_el:
                    continue

                href = url_el.get("href", "")
                # Decode DuckDuckGo redirect URL
                if "uddg=" in href:
                    try:
                        href = urllib.parse.unquote(
                            href.split("uddg=")[1].split("&")[0]
                        )
                    except Exception:
                        pass

                if not _is_valid_domain(href):
                    continue

                title_el = result.find("a", class_="result__title")
                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    continue

                # Clean title
                clean = re.split(r"[|\-–]", title)[0].strip()

                rec = DiscoveryRecord(
                    business_name=clean or title,
                    source=self.name,
                    website=href,
                    category=keyword,
                )
                rec.quality_score = 10 + (40 if rec.website else 0)
                extracted.append(rec)

            logger.info(f"[duckduckgo] {len(extracted)} results for '{query}'")
        except Exception as exc:
            logger.error(f"[duckduckgo] Failed: {exc}")

        return extracted
