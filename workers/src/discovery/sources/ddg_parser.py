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

from discovery.anti_block import random_user_agent

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


def parse_ddg_html(
    html: str,
    excluded_domains: Optional[Set[str]] = None,
    max_results: int = 50,
    extract_phones: bool = True,
) -> List[DDGResult]:
    """
    Parse DuckDuckGo HTML search results page.

    Returns a list of DDGResult with clean URLs, titles, snippets, and phones.
    """
    results: List[DDGResult] = []
    seen_domains: Set[str] = set()

    soup = BeautifulSoup(html, "html.parser")

    for result_div in soup.find_all("div", class_="result"):
        if len(results) >= max_results:
            break

        # Extract URL
        url_el = result_div.find("a", class_="result__url")
        if not url_el:
            continue

        href = url_el.get("href", "")
        href = unwrap_ddg_redirect(href)

        if not is_valid_domain(href, excluded_domains):
            continue

        domain = extract_domain(href)
        if domain in seen_domains:
            continue
        seen_domains.add(domain)

        # Extract title
        title_el = result_div.find("a", class_="result__title")
        title = title_el.get_text(strip=True) if title_el else ""
        clean = clean_title(title)

        if not clean:
            continue

        # Extract snippet
        snippet_el = result_div.find("div", class_="result__snippet") or result_div.find("a", class_="result__snippet")
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""

        # Extract phone from snippet
        phone = None
        if extract_phones:
            phone = extract_phone_from_text(snippet)
            if not phone:
                phone = extract_phone_from_text(title)

        results.append(DDGResult(
            title=clean,
            url=href,
            domain=domain,
            snippet=snippet[:300],
            phone=phone,
        ))

    return results


def search_ddg(
    query: str,
    max_results: int = 30,
    pages: int = 1,
    excluded_domains: Optional[Set[str]] = None,
    extract_phones: bool = True,
    timeout: int = 12,
) -> List[DDGResult]:
    """
    Execute a DuckDuckGo HTML search and return parsed results.

    Supports multi-page by passing pages > 1 (uses s= offset).
    """
    all_results: List[DDGResult] = []
    seen_domains: Set[str] = set()

    for page_num in range(pages):
        offset = page_num * 30
        params = {"q": query}
        if offset > 0:
            params["s"] = str(offset)
            params["dc"] = str(offset + 1)

        try:
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-IN,en;q=0.9",
                "Referer": "https://duckduckgo.com/",
            }
            resp = requests.get(
                DDG_HTML_URL, params=params, headers=headers, timeout=timeout
            )
            resp.raise_for_status()

            page_results = parse_ddg_html(
                resp.text,
                excluded_domains=excluded_domains,
                max_results=max_results,
                extract_phones=extract_phones,
            )

            for r in page_results:
                if r.domain not in seen_domains:
                    seen_domains.add(r.domain)
                    all_results.append(r)

            if len(all_results) >= max_results:
                break

            # Don't hammer DDG between pages
            if page_num < pages - 1:
                import time
                time.sleep(1.5 + (page_num * 0.5))

        except Exception as exc:
            logger.warning(f"[ddg_parser] Page {page_num + 1} failed: {exc}")
            break

    return all_results[:max_results]


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
