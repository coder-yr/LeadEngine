import asyncio
import logging
import re
import os
import random
from typing import List, Dict, Optional

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

DEFAULT_MAX_RESULTS = 50

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
]

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
    max_retries = 3

    for scrape_attempt in range(max_retries):
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage"
                    ],
                )
                context = await browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent=random.choice(USER_AGENTS),
                )
                page = await context.new_page()

                # Anti-bot script
                await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

                try:
                    logger.info(f"IndiaMart: Navigating to {url} (Attempt {scrape_attempt + 1})")
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
                        'section.listing',             # Fallback
                        'div[class*="card"]'           # Fallback
                    ]

                    cards = []
                    for sel in card_selectors:
                        cards = await page.locator(sel).all()
                        if cards:
                            logger.info(f"Found {len(cards)} IndiaMart cards with selector: {sel}")
                            break

                    if not cards:
                        # Broad fallback
                        cards = await page.locator('[data-type="seller"], [class*="seller-info"], div.company-details').all()
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
                                'h2 a, h3, [class*="companyname"], [class*="seller-name"]'
                            )
                            if name_el:
                                business["Business Name"] = (await name_el.inner_text()).strip()

                            # Contact Person
                            person_el = await card.query_selector(
                                'span.pname, [class*="contact-person"], '
                                'span.cnt_name, p[class*="person"]'
                            )
                            if person_el:
                                business["Contact Person"] = (await person_el.inner_text()).strip()

                            # Address / City
                            addr_el = await card.query_selector(
                                'span.l-cty, span.city-seo, '
                                '[class*="location"], [class*="address"], p.city'
                            )
                            if addr_el:
                                business["Address"] = (await addr_el.inner_text()).strip()

                            # Phone - IndiaMart sometimes shows partial numbers
                            phone_el = await card.query_selector(
                                'span.phn_number, a[href^="tel:"], '
                                'span.phone-text, [class*="mobile"], div[class*="contact"]'
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
                                'a[class*="website"], a[data-type="website"], a[title*="Website"]'
                            )
                            if website_el:
                                href = await website_el.get_attribute('href')
                                if href and 'indiamart' not in href:
                                    business["Website"] = href

                            # Products/Services
                            product_el = await card.query_selector(
                                'p.lst-p, [class*="product-name"], '
                                'span.product-text, ul.product-list'
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

                    break # exit retry loop on success
                
                except Exception as e:
                    logger.error(f"IndiaMart: Error scraping data: {e}")
                    try:
                        os.makedirs("error_screenshots", exist_ok=True)
                        await page.screenshot(path=f"error_screenshots/indiamart_error_attempt_{scrape_attempt + 1}.png", full_page=True)
                        logger.info("Saved error screenshot.")
                    except Exception as ss_e:
                        logger.error(f"Failed to save screenshot: {ss_e}")
                    raise e
                finally:
                    await browser.close()
        except Exception as outer_e:
            if scrape_attempt < max_retries - 1:
                backoff = (2 ** scrape_attempt) * 2000
                logger.warning(f"Retrying IndiaMart overall scraping in {backoff}ms...")
                await asyncio.sleep(backoff / 1000.0)
            else:
                logger.error(f"Critical error after {max_retries} attempts on IndiaMart: {outer_e}")

        if extracted_data:
            break

    logger.info(f"IndiaMart scraping complete. Total results: {len(extracted_data)}")
    return extracted_data
