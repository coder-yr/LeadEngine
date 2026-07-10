"""
mca_registry.py — Tier 2 MCA (Ministry of Corporate Affairs) registry source.

Searches the public MCA company database for Indian registered companies.
Uses the public search endpoint — no authentication required.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import List, Optional

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent

logger = logging.getLogger(__name__)


class MCARegistrySource(BaseDiscoverySource):
    name = "mca_registry"
    tier = 2
    reliability_stars = 4

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        extracted: List[DiscoveryRecord] = []

        # MCA has a public JSON API for company search
        try:
            # Try MCA company search API
            api_url = "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do"
            params = {"company_name": f"{keyword}", "city": city}
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "application/json, text/html",
                "Referer": "https://www.mca.gov.in/",
            }
            resp = requests.get(api_url, params=params, headers=headers, timeout=15)

            if resp.status_code == 200:
                try:
                    data = resp.json()
                    companies = data.get("data", []) or data.get("companies", [])
                    for company in companies[:max_results]:
                        name = company.get("company_name") or company.get("name")
                        if not name:
                            continue
                        rec = DiscoveryRecord(
                            business_name=name,
                            source=self.name,
                            address=company.get("registered_office_address") or company.get("address"),
                            cin=company.get("cin"),
                            raw_data={
                                "cin": company.get("cin"),
                                "date_of_registration": company.get("date_of_registration"),
                                "company_status": company.get("company_status"),
                                "company_type": company.get("company_type"),
                                "roc": company.get("roc"),
                            },
                        )
                        rec.quality_score = 30 + (10 if rec.cin else 0)
                        extracted.append(rec)
                except Exception:
                    # HTML response — parse table
                    extracted = self._parse_html(resp.text, max_results)

        except Exception as exc:
            logger.warning(f"[mca_registry] MCA API failed: {exc}")
            # Fallback: search via DuckDuckGo dork
            extracted = await self._dork_fallback(keyword, city, max_results)

        logger.info(f"[mca_registry] {len(extracted)} companies found")
        return extracted

    def _parse_html(self, html: str, max_results: int) -> List[DiscoveryRecord]:
        records = []
        try:
            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table")
            if not table:
                return []
            for row in table.find_all("tr")[1:max_results + 1]:
                cells = row.find_all("td")
                if not cells:
                    continue
                name = cells[0].get_text(strip=True)
                if name:
                    rec = DiscoveryRecord(
                        business_name=name,
                        source=self.name,
                        cin=cells[1].get_text(strip=True) if len(cells) > 1 else None,
                        address=cells[2].get_text(strip=True) if len(cells) > 2 else None,
                    )
                    rec.quality_score = 25
                    records.append(rec)
        except Exception as exc:
            logger.debug(f"[mca_registry] HTML parse error: {exc}")
        return records

    async def _dork_fallback(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        """Use DuckDuckGo to find MCA-indexed company pages."""
        records = []
        try:
            query = urllib.parse.quote(f'site:mca.gov.in "{keyword}" "{city}"')
            url = f"https://html.duckduckgo.com/html/?q={query}"
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            for result in soup.find_all("div", class_="result")[:max_results]:
                title_el = result.find("a", class_="result__title")
                title = title_el.get_text(strip=True) if title_el else ""
                if title:
                    rec = DiscoveryRecord(
                        business_name=title.split("|")[0].strip(),
                        source=self.name,
                        raw_data={"via": "dork_fallback"},
                    )
                    rec.quality_score = 20
                    records.append(rec)
        except Exception as exc:
            logger.debug(f"[mca_registry] Dork fallback failed: {exc}")
        return records
