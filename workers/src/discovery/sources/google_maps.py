"""
google_maps.py — Tier 1 Google Maps source adapter.
Migrated from gmaps_scraper.py into the plugin architecture.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import urllib.parse
from typing import List, Optional

from playwright.async_api import async_playwright, Page

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.anti_block import (
    STEALTH_SCRIPT, random_user_agent, random_viewport,
    human_delay, short_delay, random_scroll,
)

logger = logging.getLogger(__name__)

SCROLL_PAUSE_MS = 1800
MAX_SCROLL_ATTEMPTS = 18


class GoogleMapsSource(BaseDiscoverySource):
    name = "google_maps"
    tier = 1
    reliability_stars = 5

    async def search(self, keyword: str, city: str, max_results: int) -> List[DiscoveryRecord]:
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
                        await human_delay(1000, 2000)

                        feed_selector = 'div[role="feed"]'
                        try:
                            await page.wait_for_selector(feed_selector, timeout=15_000)
                        except Exception:
                            logger.warning("[google_maps] Feed not found, continuing anyway")

                        listings_selector = ".hfpxzc, a[href*='/maps/place/']"
                        initial_count = len(await page.locator(listings_selector).all())
                        if initial_count < max_results:
                            await self._scroll_feed(page, feed_selector, max_results)

                        listings = await page.locator(listings_selector).all()
                        logger.info(f"[google_maps] Found {len(listings)} listings")

                        for listing in listings[:max_results]:
                            rec = await self._extract_listing(page, listing)
                            if rec:
                                extracted.append(rec)
                            if len(extracted) >= max_results:
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

    async def _scroll_feed(self, page: Page, selector: str, target: int) -> None:
        scrolls = min(MAX_SCROLL_ATTEMPTS, (target // 5) + 3)
        for i in range(scrolls):
            await page.evaluate(
                f"const f = document.querySelector('{selector}'); if (f) f.scrollTop = f.scrollHeight;"
            )
            await page.wait_for_timeout(SCROLL_PAUSE_MS)
            if await page.query_selector("span.HlvSq"):
                break

    async def _extract_listing(self, page: Page, listing) -> Optional[DiscoveryRecord]:
        try:
            name = await listing.get_attribute("aria-label", timeout=1000)
            if not name:
                return None

            try:
                await listing.scroll_into_view_if_needed(timeout=1000)
                await listing.click(timeout=1000)
                # Wait for the side panel to load
                await page.wait_for_timeout(1000)
            except Exception:
                # If clicking fails (or element is detached due to virtual scrolling), skip
                return None

            rec = DiscoveryRecord(business_name=name, source=self.name)

            rating_el = await page.query_selector('span[aria-label*="stars"]')
            if rating_el:
                label = await rating_el.get_attribute("aria-label")
                rec.rating = label.split()[0] if label else None

            addr_btn = await page.query_selector(
                'button[data-item-id="address"], button[aria-label^="Address:"]'
            )
            if addr_btn:
                label = await addr_btn.get_attribute("aria-label")
                rec.address = (
                    label.replace("Address: ", "").strip() if label else None
                )

            phone_btn = await page.query_selector(
                'button[data-item-id^="phone:tel:"], button[aria-label^="Phone:"]'
            )
            if phone_btn:
                label = await phone_btn.get_attribute("aria-label")
                rec.phone = (
                    label.replace("Phone: ", "").strip() if label else None
                )

            web_btn = await page.query_selector(
                'a[data-item-id="authority"], a[aria-label^="Website:"]'
            )
            if web_btn:
                rec.website = await web_btn.get_attribute("href")

            rec.quality_score = self._quality(rec)
            return rec

        except Exception as exc:
            logger.debug(f"[google_maps] Extract failed: {exc}")
            return None

    @staticmethod
    def _quality(rec: DiscoveryRecord) -> int:
        score = 0
        if rec.website:
            score += 40
        if rec.phone:
            score += 30
        if rec.address:
            score += 15
        if rec.rating:
            score += 5
        return score + 20  # Base source bonus
