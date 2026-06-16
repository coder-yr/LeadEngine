import asyncio
import logging
import re
from typing import List, Dict, Optional

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

DEFAULT_MAX_RESULTS = 50


async def scrape_indiamart(
    keyword: str,
    city: str,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> List[Dict[str, Optional[str]]]:
    """
    Scrapes IndiaMart for business/supplier listings.

    Args:
        keyword: Product/service keyword (e.g., 'dental equipment')
        city: City name (e.g., 'Mumbai')
        max_results: Maximum number of results to return

    Returns:
        List of business profiles with source='indiamart'.
    """
    keyword_encoded = keyword.strip().replace(" ", "+")
    city_encoded = city.strip().replace(" ", "+")
    url = f"https://dir.indiamart.com/search.mp?ss={keyword_encoded}&cq={city_encoded}"

    extracted_data: List[Dict[str, Optional[str]]] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        try:
            logger.info(f"IndiaMart: Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            # Scroll to load more results
            for _ in range(3):
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(2000)

            # IndiaMart listing selectors
            card_selectors = [
                'div.ls-nl',                   # New layout listing card
                'div.lst-cl',                  # Classic layout
                'div[class*="cardlinks"]',
                'div.brs-card',
                'div.productwrap',
            ]

            cards = []
            for sel in card_selectors:
                cards = await page.locator(sel).all()
                if cards:
                    logger.info(f"Found {len(cards)} IndiaMart cards with selector: {sel}")
                    break

            if not cards:
                # Broad fallback
                cards = await page.locator('[data-type="seller"]').all()
                logger.info(f"Fallback found {len(cards)} IndiaMart cards")

            for card in cards[:max_results]:
                try:
                    business: Dict[str, Optional[str]] = {
                        "Business Name": None,
                        "Contact Person": None,
                        "Address": None,
                        "Website": None,
                        "Phone": None,
                        "Products": None,
                        "GST": None,
                        "source": "indiamart",
                    }

                    # Company Name
                    name_el = await card.query_selector(
                        'a.lcname, span.lcname, a.company-name, '
                        'h2 a, [class*="companyname"], [class*="seller-name"]'
                    )
                    if name_el:
                        business["Business Name"] = (await name_el.inner_text()).strip()

                    # Contact Person
                    person_el = await card.query_selector(
                        'span.pname, [class*="contact-person"], '
                        'span.cnt_name'
                    )
                    if person_el:
                        business["Contact Person"] = (await person_el.inner_text()).strip()

                    # Address / City
                    addr_el = await card.query_selector(
                        'span.l-cty, span.city-seo, '
                        '[class*="location"], [class*="address"]'
                    )
                    if addr_el:
                        business["Address"] = (await addr_el.inner_text()).strip()

                    # Phone - IndiaMart sometimes shows partial numbers
                    phone_el = await card.query_selector(
                        'span.phn_number, a[href^="tel:"], '
                        'span.phone-text, [class*="mobile"]'
                    )
                    if phone_el:
                        tel_href = await phone_el.get_attribute('href')
                        if tel_href and tel_href.startswith('tel:'):
                            business["Phone"] = tel_href.replace('tel:', '').strip()
                        else:
                            phone_text = (await phone_el.inner_text()).strip()
                            cleaned = re.sub(r'[^\d+]', '', phone_text)
                            if len(cleaned) >= 7:
                                business["Phone"] = cleaned

                    # Website
                    website_el = await card.query_selector(
                        'a[class*="website"], a[data-type="website"]'
                    )
                    if website_el:
                        href = await website_el.get_attribute('href')
                        if href and 'indiamart' not in href:
                            business["Website"] = href

                    # Products/Services
                    product_el = await card.query_selector(
                        'p.lst-p, [class*="product-name"], '
                        'span.product-text'
                    )
                    if product_el:
                        business["Products"] = (await product_el.inner_text()).strip()[:200]

                    # GST Number (sometimes visible)
                    gst_el = await card.query_selector(
                        'span.gst, [class*="gst"], span[title*="GST"]'
                    )
                    if gst_el:
                        gst_text = (await gst_el.inner_text()).strip()
                        gst_match = re.search(r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}', gst_text)
                        if gst_match:
                            business["GST"] = gst_match.group()

                    if business["Business Name"]:
                        extracted_data.append(business)
                        logger.info(f"IndiaMart: Extracted {business['Business Name']}")

                    await page.wait_for_timeout(500)

                except Exception as e:
                    logger.warning(f"IndiaMart: Error extracting card: {e}")
                    continue

                if len(extracted_data) >= max_results:
                    break

        except Exception as e:
            logger.error(f"IndiaMart: Critical error: {e}")
        finally:
            await browser.close()

    logger.info(f"IndiaMart scraping complete. Total results: {len(extracted_data)}")
    return extracted_data
