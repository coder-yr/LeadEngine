"""
zauba_corp.py — Tier 2 Zauba Corp data scraper.

Extracts company data, directors, and registered address.
Uses BeautifulSoup and falls back to DuckDuckGo dork search.
"""

from __future__ import annotations

import logging
import re
from typing import List

import requests
from bs4 import BeautifulSoup

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import random_user_agent
from discovery.sources.ddg_parser import dork_search

logger = logging.getLogger(__name__)


class ZaubaCorpSource(BaseDiscoverySource):
    name = "zauba_corp"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        extracted = self._direct_search(keyword, city, max_results)
        
        if len(extracted) < max_results // 3:
            logger.info(f"[zauba_corp] Direct search yielded {len(extracted)}, trying dork fallback")
            dork_results = dork_search(
                site="zaubacorp.com",
                keyword=keyword,
                city=city,
                max_results=max_results - len(extracted)
            )
            
            seen_names = {r.business_name.lower() for r in extracted}
            for dr in dork_results:
                if dr.title and dr.title.lower() not in seen_names:
                    seen_names.add(dr.title.lower())
                    
                    # Clean title: usually "COMPANY NAME - Company Details - Zauba Corp"
                    clean_name = re.split(r"\s+-\s+Company Details", dr.title)[0].strip()
                    
                    rec = DiscoveryRecord(
                        business_name=clean_name or dr.title,
                        source=self.name,
                        raw_data={"zauba_url": dr.url, "via": "dork"}
                    )
                    rec.quality_score = 15
                    extracted.append(rec)
                    
        return extracted[:max_results]

    def _direct_search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
        records: List[DiscoveryRecord] = []
        try:
            # Zauba uses a POST to a custom search endpoint
            url = "https://www.zaubacorp.com/custom-search"
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "*/*",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
            }
            payload = {"search": f"{keyword} {city}", "filter": "company"}
            
            resp = requests.post(url, data=payload, headers=headers, timeout=12)
            if resp.status_code != 200:
                return records

            if "cf-browser-verification" in resp.text:
                logger.warning("[zauba_corp] Blocked by Cloudflare challenge")
                return records
                
            soup = BeautifulSoup(resp.text, "html.parser")
            results = soup.find_all("div", class_="show")
            
            for result in results[:max_results]:
                name = result.get_text(strip=True)
                if not name:
                    continue
                    
                # Extract CIN from the id attr (format: company/COMPANY-NAME/CIN)
                comp_id = result.get("id", "")
                cin = comp_id.split("/")[-1] if comp_id else None
                company_url = f"https://www.zaubacorp.com/{comp_id}" if comp_id else None

                rec = DiscoveryRecord(
                    business_name=name,
                    source=self.name,
                    raw_data={"zauba_url": company_url, "cin": cin}
                )
                
                # Fetch company detail page for directors/address if URL exists
                if company_url:
                    self._enrich_from_detail_page(rec, company_url)
                
                rec.quality_score = 15 + (10 if rec.address else 0) + (10 if getattr(rec, "directors", None) else 0)
                records.append(rec)

        except Exception as exc:
            logger.debug(f"[zauba_corp] Direct search failed: {exc}")
            
        return records

    def _enrich_from_detail_page(self, rec: DiscoveryRecord, url: str) -> None:
        try:
            headers = {"User-Agent": random_user_agent()}
            resp = requests.get(url, headers=headers, timeout=8)
            if resp.status_code != 200:
                return
                
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Email (Zauba usually masks it, but sometimes visible or partially visible)
            email_td = soup.find(text=re.compile(r"Email ID:"))
            if email_td:
                email_val = email_td.find_next("p") or email_td.parent.find_next_sibling("td")
                if email_val:
                    rec.email = email_val.get_text(strip=True)
            
            # Registered Address
            addr_td = soup.find(text=re.compile(r"Registered Address"))
            if addr_td:
                addr_val = addr_td.find_next("p") or addr_td.parent.find_next_sibling("td")
                if addr_val:
                    rec.address = addr_val.get_text(strip=True)
            
            # Directors
            directors_table = soup.find("table", class_="table-striped")
            if directors_table:
                directors = []
                for row in directors_table.find_all("tr")[1:]:  # Skip header
                    cols = row.find_all("td")
                    if len(cols) >= 2:
                        name = cols[1].get_text(strip=True)
                        if name:
                            directors.append(name)
                if directors:
                    rec.directors = directors

        except Exception as exc:
            logger.debug(f"[zauba_corp] Detail extraction failed for {url}: {exc}")
