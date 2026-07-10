"""
mca_registry.py — Tier 2 MCA Registry source.

Uses DuckDuckGo dorks as primary, as MCA's actual API requires CAPTCHA.
Looks for CINs in snippets.
"""

from __future__ import annotations

import logging
import re
from typing import List, Set

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.sources.ddg_parser import search_ddg, DEFAULT_EXCLUDED_DOMAINS

logger = logging.getLogger(__name__)

# MCA CIN pattern (e.g. U72200MH2000PTC129188)
CIN_RE = re.compile(r"[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}")


class MCARegistrySource(BaseDiscoverySource):
    name = "mca_registry"
    tier = 2
    reliability_stars = 3

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        queries = [
            f'site:mca.gov.in "{keyword}" "{city}"',
            f'site:zaubacorp.com/company/ "{keyword}" "{city}"',
            f'site:tofler.in/company/ "{keyword}" "{city}"'
        ]
        
        extracted: List[DiscoveryRecord] = []
        seen_cins: Set[str] = set()

        for query in queries:
            if len(extracted) >= max_results:
                break
                
            limit = max(10, max_results // len(queries))
            results = search_ddg(
                query=query,
                max_results=limit,
                pages=1,
                # For MCA/Zauba we want these specific sites
                excluded_domains=set(), 
                extract_phones=False,
            )
            
            for r in results:
                # Try to extract CIN from snippet or title
                cin_match = CIN_RE.search(r.snippet) or CIN_RE.search(r.title)
                cin = cin_match.group(0) if cin_match else None
                
                # If we've seen this company's CIN already, skip
                if cin and cin in seen_cins:
                    continue
                if cin:
                    seen_cins.add(cin)

                # Clean up title
                clean_name = r.title
                for suffix in ["- Company Details", "- Zauba Corp", "- Tofler", "- Ministry of Corporate Affairs"]:
                    clean_name = re.split(f"\\s+{suffix}", clean_name, flags=re.IGNORECASE)[0]
                clean_name = clean_name.strip(" |,-")

                rec = DiscoveryRecord(
                    business_name=clean_name,
                    source=self.name,
                    raw_data={"url": r.url, "cin": cin}
                )
                rec.quality_score = 15 + (10 if cin else 0)
                extracted.append(rec)

        logger.info(f"[mca_registry] {len(extracted)} results across {len(queries)} queries")
        return extracted[:max_results]
