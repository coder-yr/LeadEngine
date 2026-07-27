"""
google_maps.py — Tier 1 Google Maps source adapter.

Production-grade implementation with:
  - Adaptive infinite scrolling (stops when no new results appear)
  - Category extraction from side panel
  - Website URL cleanup (strips Google redirects)
  - Per-listing retry on extraction failure
  - In-session duplicate detection by name
  - Robust error handling per listing (never crashes the batch)
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import urllib.parse
from typing import List, Optional, Set

from playwright.async_api import async_playwright, Page, Locator

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import (
    STEALTH_SCRIPT, random_user_agent, random_viewport,
    human_delay, short_delay,
)

logger = logging.getLogger(__name__)

# Scrolling config
SCROLL_PAUSE_MS = 2000
MAX_SCROLL_STALLS = 4          # Stop after N consecutive scrolls with 0 new listings
MAX_SCROLL_ABSOLUTE = 40       # Hard ceiling to prevent infinite loops
LISTING_CLICK_TIMEOUT = 1500   # ms to wait for side panel after click
PANEL_LOAD_WAIT = 1200         # ms to wait for panel data to render


class GoogleMapsSource(BaseDiscoverySource):
    name = "google_maps"
    tier = 1
    reliability_stars = 5

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        query = urllib.parse.quote(f"{keyword} {city}")
        url = f"https://www.google.com/maps/search/{query}"
        extracted: List[DiscoveryRecord] = []

        for attempt in range(3):
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(
                        headless=True,
                        args=[
                            "--disable-blink-features=AutomationControlled",
                            "--no-sandbox",
                            "--disable-setuid-sandbox",
                            "--disable-dev-shm-usage",
                            "--disable-gpu",
                        ],
                    )
                    ctx = await browser.new_context(
                        viewport=random_viewport(),
                        user_agent=random_user_agent(),
                        locale="en-IN",
                    )
                    page = await ctx.new_page()
                    await page.add_init_script(STEALTH_SCRIPT)

                    try:
                        logger.info(f"[google_maps] Navigating (attempt {attempt + 1})")
                        await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                        await human_delay(1500, 3000)

                        # Adaptive scrolling and chunked extraction
                        feed_selector = 'div[role="feed"]'
                        try:
                            await page.wait_for_selector(feed_selector, timeout=15_000)
                        except Exception:
                            logger.warning("[google_maps] Feed not found, continuing anyway")

                        listings_selector = ".hfpxzc, a[href*='/maps/place/']"
                        seen_names: Set[str] = set()
                        stalls = 0

                        for scroll_num in range(MAX_SCROLL_ABSOLUTE):
                            if len(extracted) >= max_results:
                                break

                            # Process currently rendered listings
                            count = await page.locator(listings_selector).count()
                            found_new = False

                            for i in range(count):
                                if len(extracted) >= max_results:
                                    break
                                
                                try:
                                    listing = page.locator(listings_selector).nth(i)
                                    name = await listing.get_attribute("aria-label", timeout=500)
                                    if not name:
                                        continue

                                    name_key = name.strip().lower()
                                    if name_key in seen_names:
                                        continue

                                    rec = await self._extract_with_retry(page, listing, seen_names)
                                    if rec:
                                        extracted.append(rec)
                                        found_new = True

                                        if len(extracted) % 20 == 0:
                                            logger.info(f"[google_maps] Progress: {len(extracted)} extracted")
                                except Exception:
                                    pass

                            if not found_new:
                                stalls += 1
                                if stalls >= MAX_SCROLL_STALLS:
                                    logger.info(f"[google_maps] Stopping scroll: {stalls} consecutive stalls at {len(extracted)} listings")
                                    break
                            else:
                                stalls = 0

                            # Scroll down for the next chunk
                            await page.evaluate(
                                f"const f = document.querySelector('{feed_selector}'); if (f) f.scrollTop = f.scrollHeight;"
                            )
                            await page.wait_for_timeout(SCROLL_PAUSE_MS + random.randint(0, 500))

                            end_marker = await page.query_selector("span.HlvSq, p.fontBodyMedium > span:has-text('end of results')")
                            if end_marker:
                                logger.info(f"[google_maps] End of results reached at scroll {scroll_num + 1}")
                                break

                        if extracted:
                            break  # Success — no need to retry

                    finally:
                        await browser.close()

            except Exception as exc:
                logger.error(f"[google_maps] Attempt {attempt + 1} failed: {exc}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))

        logger.info(f"[google_maps] Completed: {len(extracted)} results")
        return extracted

    async def _extract_with_retry(
        self, page: Page, listing: Locator, seen_names: Set[str]
    ) -> Optional[DiscoveryRecord]:
        """Try to extract a listing, retry once on failure."""
        rec = await self._extract_listing(page, listing, seen_names)
        if rec is not None:
            return rec

        # Retry once after a short delay
        await short_delay(400, 800)
        return await self._extract_listing(page, listing, seen_names)

    async def _extract_listing(
        self, page: Page, listing: Locator, seen_names: Set[str]
    ) -> Optional[DiscoveryRecord]:
        try:
            name = await listing.get_attribute("aria-label", timeout=1000)
            if not name:
                return None

            # In-session dedup by name
            name_key = name.strip().lower()
            if name_key in seen_names:
                return None
            seen_names.add(name_key)
            
            rec = DiscoveryRecord(business_name=name.strip(), source=self.name)
            
            # Extract basic info from the feed card if possible
            rating_text = await listing.inner_text()
            if "stars" in rating_text or "star" in rating_text:
                match = re.search(r'([\d\.]+)\s*stars?', rating_text)
                if match:
                    rec.rating = match.group(1)

            # Get the URL
            href = await listing.get_attribute("href", timeout=1000)
            if not href:
                return rec
                
            # Open listing in a new tab to avoid breaking the search page DOM
            context = page.context
            new_page = await context.new_page()
            
            try:
                await new_page.goto(href, wait_until="domcontentloaded", timeout=10000)
                await new_page.wait_for_timeout(PANEL_LOAD_WAIT)
                
                # Rating (fallback)
                if not rec.rating:
                    rating_el = await new_page.query_selector('span[aria-label*="stars"]')
                    if rating_el:
                        label = await rating_el.get_attribute("aria-label")
                        rec.rating = label.split()[0] if label else None

                # Address
                addr_btn = await new_page.query_selector(
                    'button[data-item-id="address"], button[aria-label^="Address:"]'
                )
                if addr_btn:
                    label = await addr_btn.get_attribute("aria-label")
                    rec.address = (
                        label.replace("Address: ", "").strip() if label else None
                    )

                # Phone
                phone_btn = await new_page.query_selector(
                    'button[data-item-id^="phone:tel:"], button[aria-label^="Phone:"]'
                )
                if phone_btn:
                    label = await phone_btn.get_attribute("aria-label")
                    rec.phone = (
                        label.replace("Phone: ", "").strip() if label else None
                    )

                # Website — with Google redirect cleanup
                web_btn = await new_page.query_selector(
                    'a[data-item-id="authority"], a[aria-label^="Website:"]'
                )
                if web_btn:
                    raw_url = await web_btn.get_attribute("href")
                    rec.website = self._clean_url(raw_url)

                # Category extraction
                category_el = await new_page.query_selector(
                    'button[data-item-id="category"], '
                    'button[jsaction*="category"] span, '
                    'span.DkEaL, '
                    'div.LrzXr'
                )
                if category_el:
                    cat_text = await category_el.inner_text()
                    if cat_text:
                        rec.category = cat_text.strip()
                        
            finally:
                await new_page.close()

            rec.quality_score = self._quality(rec)
            return rec

        except Exception as exc:
            logger.debug(f"[google_maps] Extract failed: {exc}")
            return None

    @staticmethod
    def _clean_url(url: Optional[str]) -> Optional[str]:
        """Strip Google redirect wrappers from URLs."""
        if not url:
            return None
        # Handle /url?q=https://real-site.com&... redirects
        if "/url?" in url and "q=" in url:
            try:
                parsed = urllib.parse.urlparse(url)
                params = urllib.parse.parse_qs(parsed.query)
                if "q" in params:
                    return params["q"][0]
            except Exception:
                pass
        # Strip UTM and tracking params for cleaner storage
        try:
            parsed = urllib.parse.urlparse(url)
            # Keep only scheme, netloc, and path
            clean = urllib.parse.urlunparse((
                parsed.scheme, parsed.netloc, parsed.path, "", "", ""
            ))
            return clean.rstrip("/") if clean else url
        except Exception:
            return url

    @staticmethod
    def _quality(rec: DiscoveryRecord) -> int:
        score = 20  # Base source bonus (Google Maps is highly reliable)
        if rec.website:
            score += 40
        if rec.phone:
            score += 25
        if rec.address:
            score += 10
        if rec.rating:
            score += 5
        if rec.category:
            score += 5
        return min(score, 100)
