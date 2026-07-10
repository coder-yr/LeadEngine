"""
website_intelligence_v2.py — 12-Stage Website Knowledge Engine.

Implements multi-page intelligent discovery, concurrent crawling, 
deterministic entity extraction, and knowledge graph construction.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
import json
from typing import Any, Dict, List, Optional, Tuple, Set
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Comment
from playwright.async_api import async_playwright

from discovery.provenance import ProvenanceField
from intelligence.cache import cache
from intelligence.website_document import WebsiteDocument, WebsitePage

logger = logging.getLogger(__name__)

# --- Configuration ---
MAX_CONCURRENT_PAGES = 5
CRAWL_TIMEOUT_SEC = 15

NOISE_TAGS = ["script", "style", "noscript", "svg", "iframe", "canvas", "nav", "aside", "header", "footer"]

# Extended Tech Signatures
TECH_SIGNATURES: Dict[str, List[str]] = {
    "React": ["react-dom", "_react", "__REACT_DEVTOOLS"],
    "Next.js": ["_next/static", "__NEXT_DATA__"],
    "Vue.js": ["__vue__", "data-v-", "vue-router"],
    "Angular": ["ng-version", "ng-app", "__ngContext__"],
    "WordPress": ["wp-content", "wp-includes", "wordpress"],
    "Shopify": ["cdn.shopify.com", "Shopify.theme"],
    "WooCommerce": ["woocommerce"],
    "Magento": ["magento", "Mage.Cookies"],
    "Wix": ["wix.com", "_wix_"],
    "Squarespace": ["squarespace.com", "static1.squarespace"],
    "HubSpot": ["hs-scripts.com", "hubspot.com"],
    "Webflow": ["webflow"],
    "Framer": ["framer.com"],
    "Cloudflare": ["cloudflare", "__cf_email__"],
    "Stripe": ["js.stripe.com"],
    "Razorpay": ["checkout.razorpay.com"],
    "Meta Pixel": ["connect.facebook.net/en_US/fbevents.js", "fbq("],
    "Google Analytics": ["google-analytics.com/analytics.js", "gtag(", "UA-", "G-"],
    "Google Tag Manager": ["googletagmanager.com/gtm.js"],
    "Hotjar": ["static.hotjar.com"],
    "Crisp": ["crisp.chat"],
    "Intercom": ["intercom.io", "intercomSettings"],
    "Tawk.to": ["tawk.to"],
    "Calendly": ["calendly.com"],
    "Zoho": ["zoho.com", "zsalesiq"],
    "Freshworks": ["freshworks.com", "freshchat"],
    "Salesforce": ["force.com", "salesforce.com"],
    "Pipedrive": ["pipedrive.com"],
}

# Extended Business Signals
BUSINESS_SIGNALS: Dict[str, List[str]] = {
    "has_booking": ["book-appointment", "calendly.com", "simplybook", "book consultation", "book demo"],
    "has_contact_form": ["<form", "contact-form", "wpcf7"],
    "has_crm": ["hubspot.com", "salesforce.com", "pipedrive.com", "zoho.com"],
    "has_whatsapp": ["wa.me", "api.whatsapp.com", "whatsapp"],
    "has_live_chat": ["tawk.to", "intercom.io", "crisp.chat", "tidio.com", "freshchat"],
    "has_newsletter": ["subscribe", "newsletter", "join our mailing list"],
    "has_careers": ["careers", "job openings", "apply now", "join our team"],
    "has_reviews": ["reviews", "testimonials", "what our clients say"],
    "has_faq": ["faq", "frequently asked questions"],
    "has_online_payments": ["checkout", "add to cart", "buy now", "stripe.com", "razorpay.com"],
    "has_ecommerce": ["product", "shop", "store", "woocommerce", "shopify"],
}

# Entity Extraction Patterns
PHONE_PATTERN = re.compile(r"(?:\+91[\s\-]?)?\b(?:0)?[6-9]\d{9}\b|(?:\+91[\s\-]?)?(?:\(\d{2,4}\)[\s\-]?)?\d{4,5}[\s\-]\d{4,6}")
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
WHATSAPP_PATTERN = re.compile(r"(?:wa\.me|api\.whatsapp\.com/send\?phone=)[\+/]?(\d{10,15})")

SOCIAL_PATTERNS = {
    "linkedin": re.compile(r'(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/[^\s\'"<>]+'),
    "instagram": re.compile(r'(?:https?://)?(?:www\.)?instagram\.com/[^\s\'"<>]+'),
    "facebook": re.compile(r'(?:https?://)?(?:www\.)?facebook\.com/(?!sharer)[^\s\'"<>]+'),
    "twitter": re.compile(r'(?:https?://)?(?:www\.)?(?:twitter|x)\.com/[^\s\'"<>]+'),
    "youtube": re.compile(r'(?:https?://)?(?:www\.)?youtube\.com/(?:c/|channel/|user/|@)[^\s\'"<>]+'),
}

LEADERSHIP_TITLES = ["founder", "ceo", "director", "partner", "owner", "dentist", "doctor", "manager", "principal", "head of"]


class PageDiscoveryEngine:
    """Discovers internal links and prioritizes them for crawling."""
    
    PRIORITY_SCORES = {
        "contact": 100,
        "about": 95,
        "team": 95,
        "leadership": 95,
        "doctor": 95,
        "dentist": 95,
        "management": 95,
        "service": 90,
        "product": 90,
        "solution": 90,
        "pricing": 80,
        "appointment": 80,
        "book": 80,
        "career": 60,
        "blog": 60,
        "news": 60,
        "case-study": 60,
        "portfolio": 60,
        "faq": 60,
        "privacy": 5,
        "terms": 5,
    }

    @staticmethod
    def extract_links(soup: BeautifulSoup, base_url: str) -> List[str]:
        links = []
        domain = urlparse(base_url).netloc
        for a in soup.find_all('a', href=True):
            href = a['href'].strip()
            if href.startswith(('mailto:', 'tel:', 'javascript:', '#')):
                continue
            full_url = urljoin(base_url, href)
            # Only internal links
            if urlparse(full_url).netloc == domain:
                links.append(full_url)
        return list(dict.fromkeys(links))

    @classmethod
    def score_page(cls, url: str) -> int:
        url_lower = url.lower()
        if urlparse(url_lower).path in ["", "/"]:
            return 100 # Homepage is highest priority
            
        max_score = 10
        for keyword, score in cls.PRIORITY_SCORES.items():
            if keyword in url_lower:
                if score > max_score:
                    max_score = score
        return max_score


class PageCrawler:
    """Concurrently fetches pages using httpx and playwright fallback."""
    
    def __init__(self, timeout: int = CRAWL_TIMEOUT_SEC):
        self.timeout = timeout
        self.client = httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            follow_redirects=True
        )

    async def fetch_all(self, urls: List[str]) -> Dict[str, Tuple[str, int]]:
        results = {}
        sem = asyncio.Semaphore(MAX_CONCURRENT_PAGES)

        async def fetch(url):
            async with sem:
                html, status = await self._fetch_single(url)
                results[url] = (html, status)

        await asyncio.gather(*(fetch(u) for u in urls))
        return results

    async def _fetch_single(self, url: str) -> Tuple[str, int]:
        try:
            resp = await self.client.get(url)
            resp.raise_for_status()
            html = resp.text
            
            # Fast fail for JS rendered SPAs or Cloudflare blocks
            if len(html) < 2000 or "cloudflare" in html.lower() or "<div id=\"root\">" in html:
                raise ValueError("Requires JS rendering")
                
            return html, resp.status_code
        except Exception as e:
            logger.debug(f"[PageCrawler] httpx failed for {url}: {e}. Falling back to Playwright.")
            return await self._playwright_fetch(url)

    async def _playwright_fetch(self, url: str) -> Tuple[str, int]:
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(user_agent="Mozilla/5.0")
                page = await context.new_page()
                await page.goto(url, timeout=self.timeout * 1000, wait_until="domcontentloaded")
                # Wait briefly for dynamic content
                await page.wait_for_timeout(1500)
                html = await page.content()
                await browser.close()
                return html, 200
        except Exception as exc:
            logger.error(f"[PageCrawler] Playwright failed for {url}: {exc}")
            return "", 0

    async def close(self):
        await self.client.aclose()


class ContentNormalizer:
    """Cleans and extracts structured entities from HTML."""
    
    @staticmethod
    def clean(html: str) -> BeautifulSoup:
        soup = BeautifulSoup(html, "html.parser")
        for tag in NOISE_TAGS:
            for el in soup.find_all(tag):
                el.decompose()
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()
        for el in soup.find_all(style=re.compile(r"display:\s*none|visibility:\s*hidden", re.I)):
            el.decompose()
        return soup

    @staticmethod
    def extract_page(url: str, soup: BeautifulSoup, html: str) -> WebsitePage:
        page = WebsitePage(url=url)
        
        # Meta
        if soup.title:
            page.title = soup.title.get_text(strip=True)
            
        meta_desc = soup.find("meta", {"name": re.compile(r"description", re.I)})
        if meta_desc:
            page.metadata["description"] = meta_desc.get("content", "")
            
        # JSON-LD Schema
        for schema in soup.find_all("script", type="application/ld+json"):
            try:
                page.schema_jsonld.append(json.loads(schema.get_text(strip=True)))
            except Exception:
                pass
                
        # Headings
        for h in soup.find_all(["h1", "h2", "h3"]):
            text = h.get_text(separator=" ", strip=True)
            if 3 < len(text) < 150:
                page.headings.append(text)
                
        # Raw Text
        page.text = re.sub(r"\s+", " ", soup.get_text(separator=" ", strip=True))[:20000]
        
        # Contacts
        page.phones = list(dict.fromkeys(PHONE_PATTERN.findall(page.text)))
        page.emails = list(dict.fromkeys(EMAIL_PATTERN.findall(page.text)))
        
        return page


class WebsiteIntelligencePipelineV2:
    """
    12-Stage Pipeline Orchestrator.
    """
    
    def __init__(self, max_pages: int = 5):
        self.max_pages = max_pages

    async def run(self, start_url: str) -> WebsiteDocument:
        domain = urlparse(start_url if start_url.startswith("http") else f"https://{start_url}").netloc.lstrip("www.")
        
        # 1. Fetch Homepage
        crawler = PageCrawler()
        hp_html, hp_status = await crawler._fetch_single(start_url)
        
        if not hp_html:
            await crawler.close()
            return WebsiteDocument(url=start_url, domain=domain, fetch_status=hp_status)
            
        hp_soup = ContentNormalizer.clean(hp_html)
        
        # 2. Page Discovery & Scoring
        all_links = PageDiscoveryEngine.extract_links(hp_soup, start_url)
        scored_links = [(link, PageDiscoveryEngine.score_page(link)) for link in all_links]
        
        # Sort by score desc, filter out very low scores (like privacy policy), and take top N
        scored_links = sorted([x for x in scored_links if x[1] > 20], key=lambda x: x[1], reverse=True)
        
        # Deduplicate paths (e.g. avoid fetching both /about and /about/)
        seen_paths = {urlparse(start_url).path.rstrip("/")}
        urls_to_fetch = [start_url]
        
        for link, score in scored_links:
            path = urlparse(link).path.rstrip("/")
            if path not in seen_paths:
                seen_paths.add(path)
                urls_to_fetch.append(link)
            if len(urls_to_fetch) >= self.max_pages:
                break
                
        # 3. Concurrent Crawling
        pages_dict = await crawler.fetch_all(urls_to_fetch[1:]) # Skip hp since we already have it
        pages_dict[start_url] = (hp_html, hp_status)
        await crawler.close()
        
        # 4. Content Normalization & Entity Extraction
        doc = WebsiteDocument(url=start_url, domain=domain, fetch_status=hp_status, pages_crawled=len(pages_dict))
        
        all_html = ""
        for page_url, (p_html, p_status) in pages_dict.items():
            if not p_html:
                continue
            all_html += p_html
            p_soup = ContentNormalizer.clean(p_html)
            w_page = ContentNormalizer.extract_page(page_url, p_soup, p_html)
            
            # Identify page type based on score logic
            score = PageDiscoveryEngine.score_page(page_url)
            if score >= 100: w_page.page_type = "contact/home"
            elif score >= 90: w_page.page_type = "about/team/service"
            
            doc.pages.append(w_page)
            
            # Aggregate global entities (deduplicated)
            for p in w_page.phones:
                if p not in [pf.value for pf in doc.phones]:
                    doc.phones.append(ProvenanceField(value=p, source=page_url, confidence=90.0))
            for e in w_page.emails:
                if e not in [pf.value for pf in doc.emails]:
                    doc.emails.append(ProvenanceField(value=e, source=page_url, confidence=90.0))
                    
        # 5. Technology Detection (Aggregated across all pages)
        all_html_lower = all_html.lower()
        for tech, sigs in TECH_SIGNATURES.items():
            if any(sig.lower() in all_html_lower for sig in sigs):
                doc.technology.append(ProvenanceField(value=tech, source="website", confidence=85.0))
                
        # 6. Business Signal Detection
        for signal, keywords in BUSINESS_SIGNALS.items():
            if any(kw.lower() in all_html_lower for kw in keywords):
                setattr(doc, signal, True)
                
        # WhatsApp & Socials
        wa_match = WHATSAPP_PATTERN.search(all_html)
        if wa_match:
            doc.whatsapp_number = ProvenanceField(value=wa_match.group(1), source="website", confidence=95.0)
            
        for platform, pattern in SOCIAL_PATTERNS.items():
            matches = pattern.findall(all_html)
            if matches:
                setattr(doc, f"{platform}_url", ProvenanceField(value=matches[0], source="website", confidence=85.0))
                
        # 7. (Optional Phase 7) Local NER for Leadership Extraction
        # We can implement a naive regex fallback here, or hook up to Local AI service.
        for page in doc.pages:
            text_lower = page.text.lower()
            if any(t in text_lower for t in LEADERSHIP_TITLES):
                # Naive heuristic: look at headings on pages that likely contain team info
                if page.page_type == "about/team/service":
                    for h in page.headings:
                        if 3 < len(h.split()) < 6: # Likely a name + title
                            if h not in [pf.value for pf in doc.leadership]:
                                doc.leadership.append(ProvenanceField(value=h, source=page.url, confidence=60.0))

        # Store full raw text
        doc.raw_text = " ".join([p.text for p in doc.pages])[:20000]
        
        # Note: Phases 8 & 9 (Business Intelligence LLM & Knowledge Graph) 
        # should be run in a separate queue (e.g. AI Insights Worker) that consumes this WebsiteDocument.

        return doc

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        url = sys.argv[1]
        pipeline = WebsiteIntelligencePipelineV2()
        doc = asyncio.run(pipeline.run(url))
        print(json.dumps(doc.to_legacy_dict(), indent=2))
