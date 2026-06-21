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

async def scrape_sulekha(
    keyword: str,
    city: str,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> List[Dict[str, Optional[str]]]:
    """
    Scrapes Sulekha for business/service listings.

    Args:
        keyword: Service keyword (e.g., 'interior designers')
        city: City name (e.g., 'Chennai')
        max_results: Maximum number of results to return

    Returns:
        List of business profiles with source='sulekha'.
    """
    keyword_slug = keyword.strip().lower().replace(" ", "-")
    city_slug = city.strip().lower().replace(" ", "-")
    url = f"https://www.sulekha.com/{keyword_slug}/{city_slug}"

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
                    logger.info(f"Sulekha: Navigating to {url} (Attempt {scrape_attempt + 1})")
                    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    await page.wait_for_timeout(3000)

                    # Scroll to load more
                    for _ in range(3):
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await page.wait_for_timeout(2000)

                    # Sulekha listing selectors
                    card_selectors = [
                        'div.merchant-card',
                        'div.listing-card',
                        'div[class*="service-card"]',
                        'div.item-card',
                        'li.service-item',
                        'div.list-item',               # Fallback
                        'div.service-provider'         # Fallback
                    ]

                    cards = []
                    for sel in card_selectors:
                        cards = await page.locator(sel).all()
                        if cards:
                            logger.info(f"Found {len(cards)} Sulekha cards with selector: {sel}")
                            break

                    if not cards:
                        # Broad fallback
                        cards = await page.locator('[class*="merchant"], [class*="business-card"], li.list-item').all()
                        logger.info(f"Fallback found {len(cards)} Sulekha cards")

                    for card in cards[:max_results]:
                        try:
                            business: Dict[str, Optional[str]] = {
                                "Business Name": None,
                                "Address": None,
                                "Website": None,
                                "Phone": None,
                                "Rating": None,
                                "Services": None,
                                "source": "sulekha",
                            }

                            # Business Name
                            name_el = await card.query_selector(
                                'h2 a, a.merchant-name, '
                                'span.business-name, [class*="comp-name"], '
                                'h3 a, h3, [class*="merchant-title"]'
                            )
                            if name_el:
                                business["Business Name"] = (await name_el.inner_text()).strip()

                            # Address
                            addr_el = await card.query_selector(
                                'span.location, [class*="address"], '
                                'span.area-name, div.location-info, address'
                            )
                            if addr_el:
                                business["Address"] = (await addr_el.inner_text()).strip()

                            # Rating
                            rating_el = await card.query_selector(
                                'span.rating, span.star-rating, '
                                '[class*="rating-value"], span[class*="rate"], div[class*="rating"]'
                            )
                            if rating_el:
                                rating_text = (await rating_el.inner_text()).strip()
                                match = re.search(r'[\d.]+', rating_text)
                                if match:
                                    business["Rating"] = match.group()

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
                                'a[class*="website"], a[title*="website"], a[href*="http"]'
                            )
                            if website_el:
                                href = await website_el.get_attribute('href')
                                if href and 'sulekha' not in href:
                                    business["Website"] = href

                            # Services
                            services_el = await card.query_selector(
                                'span.services, [class*="service-list"], '
                                'p.service-text, ul.services'
                            )
                            if services_el:
                                business["Services"] = (await services_el.inner_text()).strip()[:200]

                            if business["Business Name"]:
                                extracted_data.append(business)
                                logger.info(f"Sulekha: Extracted {business['Business Name']}")

                            await page.wait_for_timeout(500)

                        except Exception as e:
                            logger.warning(f"Sulekha: Error extracting card: {e}")
                            continue

                        if len(extracted_data) >= max_results:
                            break

                    break # Success, exit retry loop

                except Exception as e:
                    logger.error(f"Sulekha: Error scraping data: {e}")
                    try:
                        os.makedirs("error_screenshots", exist_ok=True)
                        await page.screenshot(path=f"error_screenshots/sulekha_error_attempt_{scrape_attempt + 1}.png", full_page=True)
                        logger.info("Saved error screenshot.")
                    except Exception as ss_e:
                        logger.error(f"Failed to save screenshot: {ss_e}")
                    raise e
                finally:
                    await browser.close()
        
        except Exception as outer_e:
            if scrape_attempt < max_retries - 1:
                backoff = (2 ** scrape_attempt) * 2000
                logger.warning(f"Retrying Sulekha overall scraping in {backoff}ms...")
                await asyncio.sleep(backoff / 1000.0)
            else:
                logger.error(f"Critical error after {max_retries} attempts on Sulekha: {outer_e}")

        if extracted_data:
            break

    logger.info(f"Sulekha scraping complete. Total results: {len(extracted_data)}")
    return extracted_data
