import asyncio
import logging
import re
from typing import List, Dict, Optional

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

DEFAULT_MAX_RESULTS = 50
REQUEST_DELAY_MS = 3000


def _decode_justdial_phone(obfuscated: str) -> str:
    """
    JustDial uses CSS-class-based font obfuscation for phone numbers.
    Classes like 'acb', 'dcb' map to digits. This maps the known patterns.
    """
    class_to_digit = {
        "icon-acb": "0", "icon-dcb": "1", "icon-gcb": "2",
        "icon-jcb": "3", "icon-mcb": "4", "icon-pcb": "5",
        "icon-scb": "6", "icon-vcb": "7", "icon-ycb": "8",
        "icon-Bcb": "9",
        # Alternative pattern
        "acb": "0", "dcb": "1", "gcb": "2", "jcb": "3",
        "mcb": "4", "pcb": "5", "scb": "6", "vcb": "7",
        "ycb": "8", "Bcb": "9",
    }
    digits = []
    for cls in obfuscated.split():
        cls_clean = cls.strip()
        if cls_clean in class_to_digit:
            digits.append(class_to_digit[cls_clean])
    return "".join(digits)


async def scrape_justdial(
    keyword: str,
    city: str,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> List[Dict[str, Optional[str]]]:
    """
    Scrapes JustDial for business listings.

    Args:
        keyword: Business type/keyword (e.g., 'dentist')
        city: City name (e.g., 'Mumbai')
        max_results: Maximum number of results to return

    Returns:
        List of business profiles with source='justdial'.
    """
    # JustDial URL pattern: justdial.com/{city}/{keyword}
    city_slug = city.strip().lower().replace(" ", "-")
    keyword_slug = keyword.strip().lower().replace(" ", "-")
    url = f"https://www.justdial.com/{city_slug}/{keyword_slug}"

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
            logger.info(f"JustDial: Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            # JustDial listing cards - multiple possible selectors
            card_selectors = [
                'li.resultbox_info',        # Modern layout
                'div.resultbox_info',
                'div.jsx-wrapper .resultbox',
                'li[class*="resultbox"]',
            ]

            cards = []
            for sel in card_selectors:
                cards = await page.locator(sel).all()
                if cards:
                    logger.info(f"Found {len(cards)} JustDial cards with selector: {sel}")
                    break

            if not cards:
                # Fallback: try to find any listing-like structure
                cards = await page.locator('[class*="store-details"], [class*="company-name"]').all()
                logger.info(f"Fallback found {len(cards)} JustDial cards")

            for card in cards[:max_results]:
                try:
                    business: Dict[str, Optional[str]] = {
                        "Business Name": None,
                        "Address": None,
                        "Website": None,
                        "Phone": None,
                        "Rating": None,
                        "Category": None,
                        "source": "justdial",
                    }

                    # Business Name
                    name_el = await card.query_selector(
                        'span.lng_cont_name, a.lng_cont_name, '
                        'h2 a, [class*="store-name"], [class*="company-name"]'
                    )
                    if name_el:
                        business["Business Name"] = (await name_el.inner_text()).strip()

                    # Address
                    addr_el = await card.query_selector(
                        'span.cont_sw_addr, [class*="address"], '
                        'span.mrehighlight, p.address-info'
                    )
                    if addr_el:
                        business["Address"] = (await addr_el.inner_text()).strip()

                    # Rating
                    rating_el = await card.query_selector(
                        'span.green-box, span.rating, [class*="star-rating"], '
                        'span[class*="rating"]'
                    )
                    if rating_el:
                        rating_text = (await rating_el.inner_text()).strip()
                        # Extract numeric rating
                        match = re.search(r'[\d.]+', rating_text)
                        if match:
                            business["Rating"] = match.group()

                    # Phone - JustDial obfuscates phone numbers with CSS classes
                    phone_container = await card.query_selector(
                        'span.mobilesv, [class*="contact-info"] span, '
                        'a[href^="tel:"]'
                    )
                    if phone_container:
                        # Try direct tel: link first
                        tel_href = await phone_container.get_attribute('href')
                        if tel_href and tel_href.startswith('tel:'):
                            business["Phone"] = tel_href.replace('tel:', '').strip()
                        else:
                            # Try to decode obfuscated phone
                            phone_spans = await phone_container.query_selector_all('span[class]')
                            if phone_spans:
                                classes = []
                                for span in phone_spans:
                                    cls = await span.get_attribute('class')
                                    if cls:
                                        classes.append(cls)
                                decoded = _decode_justdial_phone(" ".join(classes))
                                if decoded and len(decoded) >= 7:
                                    business["Phone"] = decoded

                    # Website
                    website_el = await card.query_selector(
                        'a.website, a[track_data*="website"], '
                        'a[href*="http"]:not([href*="justdial"])'
                    )
                    if website_el:
                        href = await website_el.get_attribute('href')
                        if href and 'justdial' not in href:
                            business["Website"] = href

                    # Category
                    cat_el = await card.query_selector(
                        'span.lng_cont_subcat, [class*="category"]'
                    )
                    if cat_el:
                        business["Category"] = (await cat_el.inner_text()).strip()

                    if business["Business Name"]:
                        extracted_data.append(business)
                        logger.info(f"JustDial: Extracted {business['Business Name']}")

                    await page.wait_for_timeout(500)

                except Exception as e:
                    logger.warning(f"JustDial: Error extracting card: {e}")
                    continue

                if len(extracted_data) >= max_results:
                    break

        except Exception as e:
            logger.error(f"JustDial: Critical error: {e}")
        finally:
            await browser.close()

    logger.info(f"JustDial scraping complete. Total results: {len(extracted_data)}")
    return extracted_data
