import asyncio
import logging
import urllib.parse
from typing import List, Dict, Optional

from playwright.async_api import async_playwright, Page

logger = logging.getLogger(__name__)

DEFAULT_MAX_RESULTS = 50
SCROLL_PAUSE_MS = 2000
MAX_SCROLL_ATTEMPTS = 15


async def _scroll_feed(page: Page, feed_selector: str, max_scrolls: int) -> None:
    """Scroll the Google Maps results feed to load more listings."""
    for i in range(max_scrolls):
        try:
            await page.evaluate(
                f"""
                const feed = document.querySelector('{feed_selector}');
                if (feed) feed.scrollTop = feed.scrollHeight;
                """
            )
            await page.wait_for_timeout(SCROLL_PAUSE_MS)

            # Check if we've reached the end of results
            end_marker = await page.query_selector('span.HlvSq')
            if end_marker:
                logger.info(f"Reached end of results after {i+1} scrolls")
                break
        except Exception as e:
            logger.warning(f"Scroll attempt {i+1} failed: {e}")
            break


async def _extract_listing(page: Page, listing, retries: int = 2) -> Optional[Dict[str, Optional[str]]]:
    """Extract data from a single listing with retry logic."""
    for attempt in range(retries + 1):
        try:
            business_data: Dict[str, Optional[str]] = {
                "Business Name": None,
                "Address": None,
                "Website": None,
                "Phone": None,
                "Rating": None,
                "source": "google_maps",
            }

            name = await listing.get_attribute('aria-label')
            if name:
                business_data["Business Name"] = name

            await listing.click()

            try:
                await page.wait_for_selector(f'h1:has-text("{name}")', timeout=5000)
                await page.wait_for_timeout(1000)
            except Exception:
                if attempt < retries:
                    logger.warning(f"Retry {attempt+1} for details panel of {name}")
                    backoff = (2 ** attempt) * 500
                    await page.wait_for_timeout(backoff)
                    continue
                logger.warning(f"Timeout waiting for details panel of {name}")
                return None

            # Extract Rating
            rating_element = await page.query_selector('span[aria-label*="stars"]')
            if rating_element:
                rating_text = await rating_element.get_attribute('aria-label')
                if rating_text:
                    business_data["Rating"] = rating_text.split()[0]

            # Extract Address
            address_btn = await page.query_selector('button[data-item-id="address"]')
            if address_btn:
                aria_label = await address_btn.get_attribute('aria-label')
                if aria_label and "Address: " in aria_label:
                    business_data["Address"] = aria_label.replace("Address: ", "").strip()

            # Extract Phone
            phone_btn = await page.query_selector('button[data-item-id^="phone:tel:"]')
            if phone_btn:
                aria_label = await phone_btn.get_attribute('aria-label')
                if aria_label and "Phone: " in aria_label:
                    business_data["Phone"] = aria_label.replace("Phone: ", "").strip()

            # Extract Website
            website_btn = await page.query_selector('a[data-item-id="authority"]')
            if website_btn:
                href = await website_btn.get_attribute('href')
                if href:
                    business_data["Website"] = href

            return business_data

        except Exception as e:
            if attempt < retries:
                backoff = (2 ** attempt) * 1000
                logger.warning(f"Error extracting (attempt {attempt+1}), retrying in {backoff}ms: {e}")
                await page.wait_for_timeout(backoff)
            else:
                logger.error(f"Failed to extract listing after {retries+1} attempts: {e}")
                return None

    return None


async def scrape_google_maps(
    keyword: str,
    city: str,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> List[Dict[str, Optional[str]]]:
    """
    Asynchronously scrapes Google Maps for businesses matching a keyword in a city.

    Args:
        keyword: The business type or keyword (e.g., 'dentist')
        city: The location (e.g., 'mumbai')
        max_results: Maximum number of results to return (default: 50)

    Returns:
        List of extracted business profiles with source='google_maps'.
    """
    search_query = urllib.parse.quote(f"{keyword} {city}")
    url = f"https://www.google.com/maps/search/{search_query}"

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
            logger.info(f"Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)

            feed_selector = 'div[role="feed"]'
            try:
                await page.wait_for_selector(feed_selector, timeout=15000)
            except Exception:
                logger.warning("Feed not found. Proceeding to check for listings.")

            # Scroll to load more results
            initial_count = len(await page.locator('.hfpxzc').all())
            if initial_count < max_results:
                scrolls_needed = min(
                    MAX_SCROLL_ATTEMPTS,
                    (max_results - initial_count) // 5 + 1,
                )
                await _scroll_feed(page, feed_selector, scrolls_needed)

            listings = await page.locator('.hfpxzc').all()
            logger.info(f"Found {len(listings)} listings after scrolling.")

            # Process up to max_results
            for listing in listings[:max_results]:
                result = await _extract_listing(page, listing)
                if result:
                    extracted_data.append(result)
                    logger.info(f"Extracted: {result['Business Name']} ({len(extracted_data)}/{max_results})")

                if len(extracted_data) >= max_results:
                    break

        except Exception as e:
            logger.error(f"Critical error during Google Maps scraping: {e}")
        finally:
            await browser.close()

    logger.info(f"Google Maps scraping complete. Total results: {len(extracted_data)}")
    return extracted_data
