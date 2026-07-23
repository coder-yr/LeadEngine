"""
ddg_parser.py — Shared DuckDuckGo HTML result parser.

Centralizes all DuckDuckGo HTML scraping logic used by:
  - duckduckgo.py
  - google_dorks.py
  - website_discovery.py
  - (any source that uses DDG dork fallbacks)

Features:
  - URL extraction and redirect unwrapping (uddg= decoding)
  - Domain validation against configurable exclusion list
  - Title cleaning (split on |, -, –)
  - Snippet extraction
  - Phone regex extraction from snippets
  - Multi-page support (s= offset parameter)
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from dataclasses import dataclass, field
from typing import List, Optional, Set

import requests
from bs4 import BeautifulSoup

from discovery.anti_block import random_user_agent, get_proxy

logger = logging.getLogger(__name__)

DDG_HTML_URL = "https://html.duckduckgo.com/html/"

# Default domains to exclude from website discovery
DEFAULT_EXCLUDED_DOMAINS: Set[str] = {
    "facebook.com", "instagram.com", "linkedin.com", "youtube.com",
    "twitter.com", "x.com", "justdial.com", "sulekha.com",
    "indiamart.com", "tradeindia.com", "wikipedia.org",
    "glassdoor.com", "naukri.com", "indeed.com", "zoominfo.com",
    "crunchbase.com", "zaubacorp.com", "tofler.in",
    "practo.com", "lybrate.com", "magicbricks.com", "99acres.com",
    "grotal.com", "asklaila.com", "hotfrog.in", "hotfrog.com",
    "yellowpages.in", "yellowpages.com", "mouthshut.com",
    "quora.com", "reddit.com",
}

# Phone patterns for Indian numbers
PHONE_RE = re.compile(
    r"""
    (?:\+91[\s\-]?)?          # Optional +91 prefix
    (?:0\d{2,4}[\s\-]?)?      # Optional STD code
    \d{5}[\s\-]?\d{5}         # 10-digit number with optional separator
    """,
    re.VERBOSE,
)


@dataclass
class DDGResult:
    """A single parsed DuckDuckGo result."""
    title: str
    url: str
    domain: str
    snippet: str = ""
    phone: Optional[str] = None


def is_valid_domain(url: str, excluded: Optional[Set[str]] = None) -> bool:
    """Check if a URL's domain is not in the exclusion list."""
    if not url:
        return False
    excluded = excluded or DEFAULT_EXCLUDED_DOMAINS
    try:
        parsed = urllib.parse.urlparse(
            url if url.startswith("http") else f"https://{url}"
        )
        domain = parsed.netloc.lower().lstrip("www.")
        if not domain:
            return False
        if domain.endswith(".gov") or domain.endswith(".gov.in") or domain.endswith(".nic.in"):
            return False
        for ex in excluded:
            if domain == ex or domain.endswith(f".{ex}"):
                return False
        return True
    except Exception:
        return False


def extract_domain(url: str) -> str:
    """Extract the clean domain from a URL."""
    try:
        parsed = urllib.parse.urlparse(
            url if url.startswith("http") else f"https://{url}"
        )
        return parsed.netloc.lower().lstrip("www.")
    except Exception:
        return ""


def unwrap_ddg_redirect(href: str) -> str:
    """Decode DuckDuckGo's uddg= redirect wrapper."""
    if "uddg=" in href:
        try:
            return urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
        except Exception:
            pass
    return href


def clean_title(title: str) -> str:
    """Clean a search result title by splitting on common separators."""
    if not title:
        return ""
    # Split on | - – — and take the first segment
    clean = re.split(r"\s*[|–—]\s*|\s+-\s+", title)[0].strip()
    return clean or title.strip()


def extract_phone_from_text(text: str) -> Optional[str]:
    """Extract an Indian phone number from text."""
    if not text:
        return None
    match = PHONE_RE.search(text)
    if match:
        phone = re.sub(r"[\s\-]", "", match.group(0))
        # Must have at least 10 digits
        digits = re.sub(r"\D", "", phone)
        if len(digits) >= 10:
            return phone
    return None


def search_ddg(
    query: str,
    max_results: int = 30,
    pages: int = 1,
    excluded_domains: Optional[Set[str]] = None,
    extract_phones: bool = True,
    timeout: int = 12,
) -> List[DDGResult]:
    """
    Execute a DuckDuckGo search using the ddgs library.
    Bypasses the HTML blocks by using the internal API.
    """
    all_results: List[DDGResult] = []
    seen_domains: Set[str] = set()
    
    try:
        from ddgs import DDGS
        import time
        import random
        
        # Add a small human delay
        delay = random.uniform(1.0, 2.5)
        logger.debug(f"[ddg_parser] Sleeping {delay:.1f}s before DDGS query to avoid rate limits")
        time.sleep(delay)
        
        # Request more than max_results because we might filter out excluded domains
        fetch_limit = max_results * 2
        ddgs = DDGS()
        
        results_iter = ddgs.text(query, max_results=fetch_limit)
        
        for r in results_iter:
            href = r.get("href", "")
            title = r.get("title", "")
            snippet = r.get("body", "")
            
            if not is_valid_domain(href, excluded_domains):
                continue
                
            domain = extract_domain(href)
            if domain in seen_domains:
                continue
            seen_domains.add(domain)
            
            clean = clean_title(title)
            if not clean:
                continue
                
            phone = None
            if extract_phones:
                phone = extract_phone_from_text(snippet)
                if not phone:
                    phone = extract_phone_from_text(title)
                    
            all_results.append(DDGResult(
                title=clean,
                url=href,
                domain=domain,
                snippet=snippet[:300],
                phone=phone,
            ))
            
            if len(all_results) >= max_results:
                break
                
    except Exception as exc:
        logger.warning(f"[ddg_parser] DDGS search failed: {exc}")
        
    return all_results

def dork_search(
    site: str,
    keyword: str,
    city: str,
    max_results: int = 20,
    timeout: int = 10,
) -> List[DDGResult]:
    """
    Convenience function for site:-prefixed dork searches.
    Example: site:justdial.com "dentist" "mumbai"
    """
    query = f'site:{site} "{keyword}" "{city}"'
    # For dork searches, don't exclude the target site
    excluded = DEFAULT_EXCLUDED_DOMAINS - {site}
    return search_ddg(
        query=query,
        max_results=max_results,
        pages=1,
        excluded_domains=excluded,
        extract_phones=True,
        timeout=timeout,
    )
