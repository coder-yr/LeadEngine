import sys
import json
import logging
import asyncio
import time
import re
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

BAD_CSS_PATTERN = re.compile(r'\b(cookie|popup|modal|newsletter|advertisement)\b', re.IGNORECASE)

# Basic keywords for semantic discovery
PAGE_KEYWORDS = ['about', 'about-us', 'team', 'leadership', 'management', 'founders', 'company', 'services', 'products', 'solutions', 'contact', 'contact-us', 'careers', 'blog']

TECH_SIGNATURES = {
    'WordPress': ['wp-content', 'wp-includes'],
    'Shopify': ['cdn.shopify.com', 'Shopify.theme'],
    'WooCommerce': ['woocommerce'],
    'React': ['react-dom', 'window.__PRELOADED_STATE__', 'id="root"'],
    'Next.js': ['_next/static', '__NEXT_DATA__'],
    'Angular': ['ng-version', 'ng-app'],
    'Vue': ['data-v-', 'vue-router'],
    'Laravel': ['laravel_session'],
    'HubSpot': ['hs-scripts.com', 'hs-analytics'],
    'Salesforce': ['force.com'],
    'Calendly': ['calendly.com'],
    'Google Analytics': ['google-analytics.com/analytics.js', 'gtag('],
    'Meta Pixel': ['connect.facebook.net/en_US/fbevents.js'],
    'Hotjar': ['static.hotjar.com'],
    'Cloudflare': ['__cf_email__', 'cloudflare-static'],
    'Stripe': ['js.stripe.com'],
    'Razorpay': ['checkout.razorpay.com'],
    'Zoho': ['zoho.com'],
    'Freshworks': ['freshworks.com', 'freshchat']
}

BUSINESS_SIGNALS = [
    'appointment', 'book demo', 'book consultation', 'call now', 'whatsapp',
    'pricing', 'testimonials', 'case studies', 'portfolio', 'clients',
    'awards', 'certifications'
]

class WebsiteCrawler:
    def __init__(self, start_url: str):
        self.start_url = start_url if start_url.startswith('http') else f"https://{start_url}"
        self.domain = urlparse(self.start_url).netloc
        self.visited = set()
        self.pages_data = []
        self.technologies = set()
        self.business_signals = set()
        self.requests_used = 0
        self.playwright_used = 0
        self.start_time = time.time()
        self.cleaning_time = 0
        self.extraction_time = 0

    async def fetch_page(self, url: str) -> str:
        try:
            self.requests_used += 1
            response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
            html = response.text
            
            # Fast fail for SPAs and Cloudflare that require JS
            if len(html) < 2000 or "cloudflare" in html.lower() or "<div id=\"root\"></div>" in html:
                raise ValueError("Requires JS rendering")
                
            return html
        except Exception:
            self.playwright_used += 1
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    context = await browser.new_context(user_agent="Mozilla/5.0")
                    page = await context.new_page()
                    await page.goto(url, timeout=15000, wait_until="domcontentloaded")
                    html = await page.content()
                    await browser.close()
                    return html
            except Exception as e:
                logger.error(f"Playwright failed for {url}: {e}")
                return ""

    def clean_html(self, html: str) -> BeautifulSoup:
        t0 = time.time()
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted tags
        for el in soup(['script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'nav', 'aside']):
            el.decompose()
            
        # Remove visually hidden elements
        for el in soup.find_all(attrs={"aria-hidden": "true"}):
            el.decompose()
        for el in soup.find_all(style=lambda value: value and ('display:none' in value.replace(' ','') or 'visibility:hidden' in value.replace(' ',''))):
            el.decompose()
            
        # Remove overlays / banners safely using word boundaries
        elements_to_decompose = []
        for el in soup.find_all(class_=lambda x: x and BAD_CSS_PATTERN.search(' '.join(x) if isinstance(x, list) else str(x))):
            elements_to_decompose.append(el)
        for el in soup.find_all(id=lambda x: x and BAD_CSS_PATTERN.search(str(x))):
            elements_to_decompose.append(el)
            
        for el in elements_to_decompose:
            if el.parent is not None:
                el.decompose()
            
        self.cleaning_time += (time.time() - t0)
        return soup

    def extract_structured_data(self, soup: BeautifulSoup, url: str):
        t0 = time.time()
        data = {
            "url": url,
            "meta": {},
            "hero": "",
            "about": "",
            "services": [],
            "products": [],
            "leadership": [],
            "testimonials": [],
            "faq": [],
            "footer": {},
            "text": ""
        }
        
        if soup.title:
            data["meta"]["title"] = soup.title.string
        desc = soup.find('meta', attrs={'name': 'description'})
        if desc:
            data["meta"]["description"] = desc.get('content', '')
            
        hero = soup.find('h1') or soup.find(class_=lambda x: x and 'hero' in str(x).lower())
        if hero:
            data["hero"] = hero.get_text(separator=' ', strip=True)
            
        def extract_section(keywords):
            sections = soup.find_all(['section', 'div'], attrs={'id': lambda x: x and any(k in str(x).lower() for k in keywords)})
            if not sections:
                sections = soup.find_all(['section', 'div'], class_=lambda x: x and any(k in str(x).lower() for k in keywords))
            return [s.get_text(separator=' ', strip=True) for s in sections]

        data["about"] = " ".join(extract_section(['about', 'story', 'who-we-are']))
        data["services"] = extract_section(['services', 'solutions', 'features'])
        data["products"] = extract_section(['products'])
        data["leadership"] = extract_section(['team', 'leadership', 'management', 'board'])
        data["testimonials"] = extract_section(['testimonial', 'review'])
        data["faq"] = extract_section(['faq', 'frequently'])
        
        footer = soup.find('footer') or soup.find(class_=lambda x: x and 'footer' in str(x).lower())
        if footer:
            data["footer"]["raw"] = footer.get_text(separator=' ', strip=True)
            
        data["text"] = soup.get_text(separator=' ', strip=True)
        
        # Tech detection
        raw_html = str(soup)
        for tech, sigs in TECH_SIGNATURES.items():
            if any(sig in raw_html for sig in sigs):
                self.technologies.add(tech)
                
        # Business signals
        lower_text = data["text"].lower()
        for signal in BUSINESS_SIGNALS:
            if signal in lower_text:
                self.business_signals.add(signal)
                
        self.extraction_time += (time.time() - t0)
        return data

    def find_links(self, soup: BeautifulSoup, base_url: str):
        links = set()
        for a in soup.find_all('a', href=True):
            href = a['href'].lower()
            if any(kw in href for kw in PAGE_KEYWORDS) and not href.startswith('mailto:') and not href.startswith('tel:'):
                full_url = urljoin(base_url, a['href'])
                if urlparse(full_url).netloc == self.domain:
                    links.add(full_url)
        return links

    async def run(self):
        urls_to_visit = [self.start_url]
        discovered_links = set(urls_to_visit)
        
        while urls_to_visit and len(self.visited) < 10 and (time.time() - self.start_time) < 20:
            current_url = urls_to_visit.pop(0)
            if current_url in self.visited:
                continue
                
            self.visited.add(current_url)
            html = await self.fetch_page(current_url)
            if not html:
                continue
                
            soup = self.clean_html(html)
            page_data = self.extract_structured_data(soup, current_url)
            self.pages_data.append(page_data)
            
            new_links = self.find_links(soup, current_url)
            for link in new_links:
                if link not in discovered_links:
                    discovered_links.add(link)
                    urls_to_visit.append(link)

        total_time = time.time() - self.start_time
        
        result = {
            "url": self.start_url,
            "pages": [p["url"] for p in self.pages_data],
            "meta": self.pages_data[0]["meta"] if self.pages_data else {},
            "hero": self.pages_data[0].get("hero", "") if self.pages_data else "",
            "about": " ".join([p.get("about", "") for p in self.pages_data]),
            "services": sum([p.get("services", []) for p in self.pages_data], []),
            "products": sum([p.get("products", []) for p in self.pages_data], []),
            "leadership": sum([p.get("leadership", []) for p in self.pages_data], []),
            "testimonials": sum([p.get("testimonials", []) for p in self.pages_data], []),
            "faq": sum([p.get("faq", []) for p in self.pages_data], []),
            "footer": self.pages_data[0].get("footer", {}) if self.pages_data else {},
            "rawText": " ".join([p.get("text", "") for p in self.pages_data]),
            "contacts": {},
            "socialProfiles": {},
            "technology": list(self.technologies),
            "businessSignals": list(self.business_signals),
            "qualityMetrics": {
                "wordCount": sum(len(p.get("text", "").split()) for p in self.pages_data),
                "pagesProcessed": len(self.pages_data)
            },
            "crawlMetrics": {
                "requestsUsed": self.requests_used,
                "playwrightUsed": self.playwright_used,
                "totalTimeSec": round(total_time, 2),
                "cleaningTimeSec": round(self.cleaning_time, 2),
                "extractionTimeSec": round(self.extraction_time, 2)
            }
        }
        
        return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing URL argument"}))
        sys.exit(1)
        
    url_arg = sys.argv[1]
    crawler = WebsiteCrawler(url_arg)
    result_data = asyncio.run(crawler.run())
    print(json.dumps(result_data))
