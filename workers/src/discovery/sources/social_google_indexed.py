"""
social_google_indexed.py — Tier 2 Social Media source via Google-indexed pages.

Uses DuckDuckGo dorks to find Facebook Pages, Instagram profiles,
and LinkedIn Company pages without direct API access.

Dork strategies:
  site:facebook.com/pages "{keyword}" "{city}"
  site:instagram.com "{keyword}" "{city}"
  site:linkedin.com/company "{keyword}" "{city}"
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent

logger = logging.getLogger(__name__)

PLATFORM_DORKS: Dict[str, str] = {
    "facebook":  'site:facebook.com/pages "{keyword}" "{city}"',
    "instagram": 'site:instagram.com "{keyword}" "{city}"',
    "linkedin":  'site:linkedin.com/company "{keyword}" "{city}"',
}


class SocialGoogleIndexedSource(BaseDiscoverySource):
    name = "social_google_indexed"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []
        per_platform = max(5, max_results // len(PLATFORM_DORKS))

        for platform, dork_template in PLATFORM_DORKS.items():
            if len(extracted) >= max_results:
                break
            dork = dork_template.format(keyword=keyword, city=city)
            records = self._ddg_search(dork, platform, per_platform)
            extracted.extend(records)

        logger.info(f"[social_google_indexed] {len(extracted)} profiles found")
        return extracted[:max_results]

    def _ddg_search(self, query: str, platform: str, limit: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://html.duckduckgo.com/html/?q={encoded}"
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html",
                "Referer": "https://duckduckgo.com/",
            }
            resp = requests.get(url, headers=headers, timeout=12)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            for result in soup.find_all("div", class_="result")[:limit]:
                title_el = result.find("a", class_="result__title")
                url_el = result.find("a", class_="result__url")

                title = title_el.get_text(strip=True) if title_el else ""
                href = url_el.get("href", "") if url_el else ""

                if "uddg=" in href:
                    try:
                        href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
                    except Exception:
                        pass

                # Check platform matches
                if platform not in href.lower():
                    continue

                # Clean name
                name = re.split(r"[|\-–@]", title)[0].strip()
                # Remove "- Home", "on Facebook", etc.
                name = re.sub(
                    r"\s*(on facebook|on instagram|on linkedin|facebook|instagram|linkedin)\s*$",
                    "",
                    name,
                    flags=re.IGNORECASE,
                ).strip()

                if not name or len(name) < 2:
                    continue

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    platform=platform,
                    profile_url=href,
                    raw_data={"platform": platform, "profile_url": href},
                )

                # Set the appropriate social link
                if platform == "facebook":
                    rec.raw_data["facebook_url"] = href
                elif platform == "instagram":
                    rec.raw_data["instagram_url"] = href
                elif platform == "linkedin":
                    rec.raw_data["linkedin_url"] = href

                rec.quality_score = 15 + (5 if href else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[social_google_indexed] {platform} search failed: {exc}")

        return records
