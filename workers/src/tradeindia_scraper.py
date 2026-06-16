import asyncio
import logging
import re
from typing import List, Dict, Optional

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

DEFAULT_MAX_RESULTS = 50


async def scrape_tradeindia(
    keyword: str,
    city: str,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> List[Dict[str, Optional[str]]]:
    """
    Scrapes TradeIndia for business/supplier listings.

    Args:
        keyword: Product/service keyword (e.g., 'packaging machines')
        city: City name (e.g., 'Delhi')
        max_results: Maximum number of results to return

    Returns:
        List of business profiles with source='tradeindia'.
    """
    keyword_encoded = keyword.strip().replace(" ", "+")
    city_encoded = city.strip().replace(" ", "+")
    url = f"https://www.tradeindia.com/search.html?keyword={keyword_encoded}&city={city_encoded}"

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
            logger.info(f"TradeIndia: Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            # Scroll to load more
            for _ in range(3):
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(2000)

            # TradeIndia listing selectors
            card_selectors = [
                'div.search-result-card',
                'div.card-body',
                'div.srp-card',
                'div[class*="search-card"]',
                'li.search-list-item',
            ]

            cards = []
            for sel in card_selectors:
                cards = await page.locator(sel).all()
                if cards:
                    logger.info(f"Found {len(cards)} TradeIndia cards with selector: {sel}")
                    break

            if not cards:
                cards = await page.locator('[class*="company-info"], [class*="supplier"]').all()
                logger.info(f"Fallback found {len(cards)} TradeIndia cards")

            for card in cards[:max_results]:
                try:
                    business: Dict[str, Optional[str]] = {
                        "Business Name": None,
                        "Contact Person": None,
                        "Address": None,
                        "Website": None,
                        "Phone": None,
                        "Products": None,
                        "source": "tradeindia",
                    }

                    # Company Name
                    name_el = await card.query_selector(
                        'h2 a, a.company-name, '
                        'span.company-name, [class*="comp-name"]'
                    )
                    if name_el:
                        business["Business Name"] = (await name_el.inner_text()).strip()

                    # Contact Person
                    person_el = await card.query_selector(
                        'span.contact-person, [class*="person-name"], '
                        'div.person-info span'
                    )
                    if person_el:
                        business["Contact Person"] = (await person_el.inner_text()).strip()

                    # Address
                    addr_el = await card.query_selector(
                        'span.location, [class*="address"], '
                        'span.city-name, div.location-info'
                    )
                    if addr_el:
                        business["Address"] = (await addr_el.inner_text()).strip()

                    # Phone
                    phone_el = await card.query_selector(
                        'a[href^="tel:"], span.phone-number, '
                        '[class*="mobile"], [class*="phone"]'
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
                        'a[class*="website"], a[title*="website"], '
                        'a[data-type="website"]'
                    )
                    if website_el:
                        href = await website_el.get_attribute('href')
                        if href and 'tradeindia' not in href:
                            business["Website"] = href

                    # Products
                    product_el = await card.query_selector(
                        'p.product-name, [class*="product"], '
                        'span.prod-name'
                    )
                    if product_el:
                        business["Products"] = (await product_el.inner_text()).strip()[:200]

                    if business["Business Name"]:
                        extracted_data.append(business)
                        logger.info(f"TradeIndia: Extracted {business['Business Name']}")

                    await page.wait_for_timeout(500)

                except Exception as e:
                    logger.warning(f"TradeIndia: Error extracting card: {e}")
                    continue

                if len(extracted_data) >= max_results:
                    break

        except Exception as e:
            logger.error(f"TradeIndia: Critical error: {e}")
        finally:
            await browser.close()

    logger.info(f"TradeIndia scraping complete. Total results: {len(extracted_data)}")
    return extracted_data
