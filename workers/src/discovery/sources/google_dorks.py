"""
google_dorks.py — Tier 1 Google Dork search via DuckDuckGo HTML.

Constructs targeted dork queries to find company websites, avoiding
directories and social platforms. Uses DuckDuckGo HTML to execute
dorks without triggering Google CAPTCHA.

Dork strategies:
  1. Direct company search: "{keyword}" "{city}" -site:justdial.com ...
  2. Contact page dork: "contact us" "{keyword}" "{city}"
  3. About page dork: "about us" "{keyword}" "{city}"
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

BLACKLIST_DOMAINS = [
    "justdial.com", "sulekha.com", "indiamart.com", "tradeindia.com",
    "wikipedia.org", "facebook.com", "instagram.com", "linkedin.com",
    "twitter.com", "youtube.com", "quora.com", "reddit.com",
    "glassdoor.com", "naukri.com", "indeed.com", "zoominfo.com",
    "yellowpages.in", "grotal.com", "asklaila.com", "hotfrog.com",
    "practo.com", "lybrate.com",
]

EXCLUDE_SUFFIX = " ".join(f"-site:{d}" for d in BLACKLIST_DOMAINS[:10])  # URL length limit


def _build_dork_queries(keyword: str, city: str) -> List[str]:
    return [
        f'"{keyword}" "{city}" {EXCLUDE_SUFFIX} site:*.in OR site:*.com',
        f'"contact us" "{keyword}" "{city}" {EXCLUDE_SUFFIX}',
        f'"about us" "{keyword}" "{city}" {EXCLUDE_SUFFIX}',
    ]


def _is_valid(url: str) -> bool:
    if not url or not url.startswith("http"):
        return False
    try:
        domain = urllib.parse.urlparse(url).netloc.lower().lstrip("www.")
        for bl in BLACKLIST_DOMAINS:
            if domain == bl or domain.endswith(f".{bl}"):
                return False
        return True
    except Exception:
        return False


class GoogleDorksSource(BaseDiscoverySource):
    name = "google_dorks"
    tier = 1
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        queries = _build_dork_queries(keyword, city)
        extracted: List[DiscoveryRecord] = []
        seen: set = set()

        for query in queries:
            if len(extracted) >= max_results:
                break
            results = self._ddg_search(query, max_results)
            for rec in results:
                domain = urllib.parse.urlparse(rec.website or "").netloc
                if domain and domain not in seen:
                    seen.add(domain)
                    extracted.append(rec)

        logger.info(f"[google_dorks] {len(extracted)} results")
        return extracted[:max_results]

    def _ddg_search(self, query: str, limit: int) -> List[DiscoveryRecord]:
        encoded = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        records: List[DiscoveryRecord] = []

        try:
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Referer": "https://duckduckgo.com/",
            }
            resp = requests.get(url, headers=headers, timeout=12)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            for result in soup.find_all("div", class_="result")[:limit]:
                url_el = result.find("a", class_="result__url")
                if not url_el:
                    continue
                href = url_el.get("href", "")
                if "uddg=" in href:
                    try:
                        href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
                    except Exception:
                        pass

                if not _is_valid(href):
                    continue

                title_el = result.find("a", class_="result__title")
                title = title_el.get_text(strip=True) if title_el else ""
                clean = re.split(r"[|\-–]", title)[0].strip() if title else ""

                rec = DiscoveryRecord(
                    business_name=clean or "Unknown",
                    source=self.name,
                    website=href,
                )
                rec.quality_score = 35  # Website found via targeted dork
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[google_dorks] DDG search failed: {exc}")

        return records
