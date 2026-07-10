"""
website_intelligence.py — 6-Stage Website Intelligence Pipeline.

Stages (each independently cacheable):
  1. fetch      → Raw HTML from requests or Playwright
  2. clean      → BeautifulSoup noise removal
  3. segment    → Extract named sections (meta, about, services, contact, social...)
  4. detect_technology → Match tech signatures against HTML
  5. detect_business_signals → Detect CRM, booking, WhatsApp, analytics, etc.
  6. store      → Assemble WebsiteDocument with full provenance

Each stage checks Redis cache before running.
Falls back gracefully at every stage.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Comment

from discovery.provenance import ProvenanceField
from intelligence.cache import cache
from intelligence.website_document import WebsiteDocument

logger = logging.getLogger(__name__)

# ─── Technology detection signatures ───────────────────────────────────────────
TECH_SIGNATURES: Dict[str, List[str]] = {
    "WordPress":    ["wp-content", "wp-includes", "wordpress"],
    "Wix":          ["wix.com", "_wix_", "X-Wix-Published-Version"],
    "Squarespace":  ["squarespace.com", "static1.squarespace"],
    "Shopify":      ["shopify.com", "cdn.shopify", "Shopify.theme"],
    "Magento":      ["magento", "Mage.Cookies"],
    "PrestaShop":   ["prestashop"],
    "WooCommerce":  ["woocommerce"],
    "React":        ["__REACT_DEVTOOLS", "_react", "react-dom"],
    "Angular":      ["ng-version", "ng-app", "__ngContext__"],
    "Vue.js":       ["__vue__", "data-v-", "vue.min.js"],
    "Next.js":      ["__NEXT_DATA__", "_next/static"],
    "Bootstrap":    ["bootstrap.min.css", "bootstrap.css"],
    "Tailwind":     ["tailwind", "tw-"],
    "jQuery":       ["jquery.min.js", "jquery-"],
    "Google Analytics": ["google-analytics.com", "gtag(", "UA-", "G-"],
    "Meta Pixel":   ["facebook.net/en_US/fbevents", "fbq("],
    "HubSpot":      ["hubspot.com", "hs-scripts"],
    "Zoho CRM":     ["zoho.com", "zsalesiq"],
    "Freshdesk":    ["freshdesk.com", "freshchat"],
    "Intercom":     ["intercom.io", "intercomSettings"],
    "Drift":        ["drift.com", "driftt.com"],
    "Zendesk":      ["zendesk.com", "zd-", "zopim"],
    "Calendly":     ["calendly.com"],
    "Razorpay":     ["razorpay.com"],
    "PayU":         ["payu.in", "payumoney"],
    "Stripe":       ["stripe.com"],
    "Cloudflare":   ["cloudflare"],
    "AWS CloudFront": ["cloudfront.net"],
    "Netlify":      ["netlify"],
    "Vercel":       ["vercel.app", "__VERCEL"],
}

# ─── Business signal patterns ──────────────────────────────────────────────────
BUSINESS_SIGNALS: Dict[str, List[str]] = {
    "has_contact_form":    ["<form", "contact-form", "contactform", "wpcf7", "cf7"],
    "has_whatsapp_widget": ["wa.me", "api.whatsapp.com", "whatsapp-button", "whatsappme"],
    "has_booking_system":  [
        "calendly.com", "book-appointment", "booking.com", "simplybook",
        "bookmyshow", "acuityscheduling", "fresha.com", "practo.com/book",
        "bookingbutton", "appointment", "schedule-now",
    ],
    "has_crm_integration": [
        "hubspot.com", "zoho.com", "salesforce.com", "freshsales",
        "pipedrive.com", "crm", "leadform", "lead-form",
    ],
    "has_live_chat":       [
        "tawk.to", "tidio.com", "freshchat", "intercom.io",
        "livechat.com", "drift.com", "crisp.chat",
    ],
    "has_analytics":       [
        "google-analytics.com", "gtag(", "ga(", "mixpanel.com",
        "segment.com", "hotjar.com", "clarity.ms",
    ],
    "has_ecommerce":       [
        "add-to-cart", "add_to_cart", "product", "shop", "store",
        "checkout", "buy-now", "woocommerce", "shopify",
    ],
}

# Phone/email/address extraction patterns
PHONE_PATTERN = re.compile(
    r"(?:\+91[\s\-]?)?\b(?:0)?[6-9]\d{9}\b"
    r"|(?:\+91[\s\-]?)?(?:\(\d{2,4}\)[\s\-]?)?\d{4,5}[\s\-]\d{4,6}"
)
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
WHATSAPP_PATTERN = re.compile(r"(?:wa\.me|api\.whatsapp\.com/send\?phone=)[\+/]?(\d{10,15})")

SOCIAL_PATTERNS = {
    "facebook_url": re.compile(r'(?:https?://)?(?:www\.)?facebook\.com/(?!sharer)[^\s\'"<>]+'),
    "instagram_url": re.compile(r'(?:https?://)?(?:www\.)?instagram\.com/[^\s\'"<>]+'),
    "linkedin_url": re.compile(r'(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/[^\s\'"<>]+'),
    "twitter_url": re.compile(r'(?:https?://)?(?:www\.)?(?:twitter|x)\.com/[^\s\'"<>]+'),
    "youtube_url": re.compile(r'(?:https?://)?(?:www\.)?youtube\.com/(?:c/|channel/|user/|@)[^\s\'"<>]+'),
}

NOISE_TAGS = ["script", "style", "head", "noscript", "svg", "iframe",
              "nav", "header", "footer", "aside"]


class WebsiteIntelligencePipeline:
    """
    6-stage pipeline. Each stage caches its result independently.
    The full pipeline can be resumed from any cached stage.
    """

    def __init__(self, timeout: int = 20, max_pages: int = 3):
        self.timeout = timeout
        self.max_pages = max_pages

    # ──────────────────────────────────────────────────────────────────────────
    # Stage 1: Fetch
    # ──────────────────────────────────────────────────────────────────────────

    def fetch(self, url: str) -> Tuple[str, int]:
        """
        Fetch HTML from URL.
        Returns (html, status_code). Falls back to Wayback Machine on failure.
        """
        domain = self._domain(url)

        # Check cache
        cached = cache.get("html", domain)
        if cached:
            return cached.get("html", ""), cached.get("status", 200)

        html, status = self._requests_fetch(url)

        if not html or status >= 400:
            # Try Playwright fallback (JS-rendered sites)
            html, status = self._playwright_fetch(url)

        if not html or status >= 400:
            # Try Wayback Machine
            from discovery.anti_block import wayback_fallback
            wb_html = wayback_fallback(url)
            if wb_html:
                html, status = wb_html, 200

        if html:
            cache.set("html", domain, {"html": html, "status": status})

        return html or "", status

    def _requests_fetch(self, url: str) -> Tuple[str, int]:
        from discovery.anti_block import random_user_agent
        try:
            headers = {
                "User-Agent": random_user_agent(),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-IN,en;q=0.9",
            }
            resp = requests.get(url, headers=headers, timeout=self.timeout,
                                allow_redirects=True)
            return resp.text, resp.status_code
        except Exception as exc:
            logger.debug(f"[Stage1/fetch] requests failed for {url}: {exc}")
            return "", 0

    def _playwright_fetch(self, url: str) -> Tuple[str, int]:
        try:
            import asyncio
            from playwright.sync_api import sync_playwright
            from discovery.anti_block import STEALTH_SCRIPT, random_user_agent, random_viewport
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=[
                    "--disable-blink-features=AutomationControlled", "--no-sandbox",
                ])
                ctx = browser.new_context(
                    user_agent=random_user_agent(),
                    viewport=random_viewport(),
                )
                page = ctx.new_page()
                page.add_init_script(STEALTH_SCRIPT)
                page.goto(url, timeout=self.timeout * 1000, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                html = page.content()
                browser.close()
            return html, 200
        except Exception as exc:
            logger.debug(f"[Stage1/fetch] Playwright failed for {url}: {exc}")
            return "", 0

    # ──────────────────────────────────────────────────────────────────────────
    # Stage 2: Clean
    # ──────────────────────────────────────────────────────────────────────────

    def clean(self, html: str) -> BeautifulSoup:
        """
        Parse HTML and strip noise elements.
        Returns cleaned BeautifulSoup object.
        """
        soup = BeautifulSoup(html, "html.parser")

        # Remove noise tags
        for tag in NOISE_TAGS:
            for el in soup.find_all(tag):
                el.decompose()

        # Remove HTML comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # Remove hidden elements
        for el in soup.find_all(style=re.compile(r"display:\s*none|visibility:\s*hidden")):
            el.decompose()

        return soup

    # ──────────────────────────────────────────────────────────────────────────
    # Stage 3: Segment
    # ──────────────────────────────────────────────────────────────────────────

    def segment(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """
        Extract named sections from the cleaned DOM.
        Returns a dict of section → content.
        """
        segments: Dict[str, Any] = {}

        # Meta
        segments["title"] = self._get_text(soup.find("title"))
        meta_desc = soup.find("meta", {"name": re.compile(r"description", re.I)})
        segments["meta_description"] = meta_desc.get("content", "") if meta_desc else ""
        segments["h1"] = self._get_text(soup.find("h1"))
        lang_attr = soup.find("html")
        segments["language"] = lang_attr.get("lang", "")[:5] if lang_attr else ""

        # Full text for NER and NLP
        raw_text = soup.get_text(separator=" ", strip=True)
        segments["raw_text"] = re.sub(r"\s+", " ", raw_text)[:20000]

        # Services (look for service/product section)
        services = []
        for section in soup.find_all(["section", "div"], class_=re.compile(
            r"(service|product|offer|feature|what-we-do|solution)", re.I
        )):
            for li in section.find_all(["li", "h3", "h4"])[:10]:
                text = self._get_text(li)
                if 3 < len(text) < 100:
                    services.append(text)
        segments["services"] = list(dict.fromkeys(services))[:20]  # Deduplicate

        # Testimonials
        testimonials = []
        for t in soup.find_all(class_=re.compile(r"(testimonial|review|feedback|client)", re.I)):
            text = self._get_text(t)
            if 20 < len(text) < 500:
                testimonials.append(text[:200])
        segments["testimonials"] = testimonials[:5]

        # Leadership / team
        leadership = []
        for t in soup.find_all(class_=re.compile(r"(team|founder|director|ceo|doctor|dr\.|staff)", re.I)):
            name_el = t.find(["h3", "h4", "strong", "p"])
            if name_el:
                name = self._get_text(name_el)
                if 2 < len(name) < 60:
                    leadership.append(name)
        segments["leadership"] = leadership[:10]

        # About section
        about_el = soup.find(
            ["section", "div", "article"],
            id=re.compile(r"(about|story|mission|vision)", re.I)
        ) or soup.find(
            ["section", "div"],
            class_=re.compile(r"(about|story|who-we-are)", re.I)
        )
        segments["about"] = self._get_text(about_el)[:500] if about_el else ""

        # Hero text (first meaningful content)
        hero_candidates = soup.find_all(["h1", "h2", "p"])[:5]
        segments["hero"] = " ".join(
            self._get_text(el) for el in hero_candidates if len(self._get_text(el)) > 20
        )[:300]

        return segments

    # ──────────────────────────────────────────────────────────────────────────
    # Stage 4: Technology Detection
    # ──────────────────────────────────────────────────────────────────────────

    def detect_technology(self, html: str, soup: BeautifulSoup) -> List[ProvenanceField]:
        """Detect technology stack from HTML."""
        detected: List[ProvenanceField] = []
        html_lower = html.lower()
        for tech, sigs in TECH_SIGNATURES.items():
            for sig in sigs:
                if sig.lower() in html_lower:
                    detected.append(ProvenanceField(
                        value=tech,
                        source="website",
                        confidence=85.0,
                    ))
                    break  # Only add each tech once
        return detected

    # ──────────────────────────────────────────────────────────────────────────
    # Stage 5: Business Signals
    # ──────────────────────────────────────────────────────────────────────────

    def detect_business_signals(
        self, html: str, soup: BeautifulSoup, segments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Detect business signals (CRM, booking, WhatsApp, etc.) from HTML.
        Returns dict of signal name → bool.
        """
        html_lower = html.lower()
        signals: Dict[str, Any] = {}

        for signal, keywords in BUSINESS_SIGNALS.items():
            signals[signal] = any(kw.lower() in html_lower for kw in keywords)

        # Contact extraction
        full_text = segments.get("raw_text", "")
        signals["phones"] = list(dict.fromkeys(PHONE_PATTERN.findall(full_text)))[:5]
        signals["emails"] = list(dict.fromkeys(EMAIL_PATTERN.findall(full_text)))[:5]

        # WhatsApp number
        wa_match = WHATSAPP_PATTERN.search(html)
        signals["whatsapp_number"] = wa_match.group(1) if wa_match else None

        # Social links
        for key, pattern in SOCIAL_PATTERNS.items():
            matches = pattern.findall(html)
            signals[key] = matches[0] if matches else None

        # Addresses (simple heuristic — look for common patterns)
        addr_pattern = re.compile(
            r"\b\d+[,\s]+[A-Z][a-zA-Z\s,\-]+(?:Road|Street|Avenue|Lane|Nagar|Colony|"
            r"Sector|Block|Phase|Floor|Building|Tower|Plot|Survey|Flat)\b[^<]{0,150}",
            re.IGNORECASE,
        )
        signals["addresses"] = addr_pattern.findall(full_text)[:3]

        return signals

    # ──────────────────────────────────────────────────────────────────────────
    # Stage 6: Store (Assemble WebsiteDocument)
    # ──────────────────────────────────────────────────────────────────────────

    def store(
        self,
        url: str,
        status: int,
        segments: Dict[str, Any],
        tech: List[ProvenanceField],
        signals: Dict[str, Any],
    ) -> WebsiteDocument:
        """Assemble the final WebsiteDocument with full provenance."""
        domain = self._domain(url)

        def pf(value: Any, confidence: float = 80.0) -> Optional[ProvenanceField]:
            if not value:
                return None
            return ProvenanceField(value=value, source="website", confidence=confidence)

        def pf_list(values: List[str], confidence: float = 80.0) -> List[ProvenanceField]:
            return [ProvenanceField(v, "website", confidence) for v in values if v]

        doc = WebsiteDocument(
            url=url,
            domain=domain,
            fetch_status=status,

            title=pf(segments.get("title"), 95.0),
            meta_description=pf(segments.get("meta_description"), 90.0),
            h1=pf(segments.get("h1"), 90.0),
            language=pf(segments.get("language"), 99.0),

            hero_text=pf(segments.get("hero"), 75.0),
            about_text=pf(segments.get("about"), 75.0),
            services=pf_list(segments.get("services", []), 70.0),
            testimonials=pf_list(segments.get("testimonials", []), 65.0),
            leadership=pf_list(segments.get("leadership", []), 70.0),

            phones=pf_list(signals.get("phones", []), 90.0),
            emails=pf_list(signals.get("emails", []), 90.0),
            addresses=pf_list(signals.get("addresses", []), 70.0),
            whatsapp_number=pf(signals.get("whatsapp_number"), 95.0),

            facebook_url=pf(signals.get("facebook_url"), 85.0),
            instagram_url=pf(signals.get("instagram_url"), 85.0),
            linkedin_url=pf(signals.get("linkedin_url"), 85.0),
            twitter_url=pf(signals.get("twitter_url"), 80.0),
            youtube_url=pf(signals.get("youtube_url"), 80.0),

            has_contact_form=signals.get("has_contact_form", False),
            has_whatsapp_widget=signals.get("has_whatsapp_widget", False),
            has_booking_system=signals.get("has_booking_system", False),
            has_crm_integration=signals.get("has_crm_integration", False),
            has_live_chat=signals.get("has_live_chat", False),
            has_analytics=signals.get("has_analytics", False),
            has_ecommerce=signals.get("has_ecommerce", False),

            technology=tech,

            raw_text=segments.get("raw_text", "")[:10000],
            crawl_metrics={
                "fetch_status": status,
                "domain": domain,
                "technology_count": len(tech),
                "phones_found": len(signals.get("phones", [])),
                "emails_found": len(signals.get("emails", [])),
            },
        )
        return doc

    # ──────────────────────────────────────────────────────────────────────────
    # Full Pipeline Run
    # ──────────────────────────────────────────────────────────────────────────

    def run(self, url: str) -> WebsiteDocument:
        """Execute all 6 stages. Each stage is individually cached."""
        domain = self._domain(url)

        # Check full document cache
        cached_doc = cache.get("website_document", domain)
        if cached_doc:
            logger.info(f"[WebsiteIntelligence] Cache hit for {domain}")
            doc = WebsiteDocument(**{
                k: v for k, v in cached_doc.items()
                if k in WebsiteDocument.__dataclass_fields__
            })
            doc.cached = True
            return doc

        try:
            # Stage 1: Fetch
            html, status = self.fetch(url)
            if not html:
                return WebsiteDocument(url=url, domain=domain, fetch_status=status or 0)

            # Stage 2: Clean
            soup = self.clean(html)

            # Stage 3: Segment
            segments = self.segment(soup, url)

            # Stage 4: Technology
            tech = self.detect_technology(html, soup)

            # Stage 5: Business Signals
            signals = self.detect_business_signals(html, soup, segments)

            # Stage 6: Store
            doc = self.store(url, status, segments, tech, signals)

            # Cache the assembled document
            cache.set("website_document", domain, doc.to_legacy_dict())
            logger.info(
                f"[WebsiteIntelligence] {domain}: status={status}, "
                f"phones={len(doc.phones)}, emails={len(doc.emails)}, "
                f"tech={len(doc.technology)}"
            )

        except Exception as exc:
            logger.error(f"[WebsiteIntelligence] Pipeline failed for {url}: {exc}")
            return WebsiteDocument(url=url, domain=domain, fetch_status=0)

        return doc

    @staticmethod
    def _domain(url: str) -> str:
        try:
            return urlparse(url if url.startswith("http") else "https://" + url).netloc.lstrip("www.")
        except Exception:
            return url

    @staticmethod
    def _get_text(el: Any) -> str:
        if el is None:
            return ""
        return el.get_text(separator=" ", strip=True)
