"""
anti_block.py — Anti-detection and block-recovery strategies.

Provides:
  - Random human-like delays
  - User agent rotation (only real desktop/mobile UAs, no bots)
  - Viewport randomization
  - Playwright stealth scripts
  - Async Wayback Machine fallback
  - Async Google cache fallback
  - Proxy rotation (reads from env PROXY_LIST)
  - HTTP retry decorator
"""

from __future__ import annotations

import asyncio
import functools
import logging
import os
import random
from typing import List, Optional, Callable, Any
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

# Real-world User Agents (Chrome/Firefox/Edge/Safari), NO BOTS
USER_AGENTS: List[str] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

VIEWPORTS = [
    {"width": 1920, "height": 1080},
    {"width": 1366, "height": 768},
    {"width": 1536, "height": 864},
    {"width": 1440, "height": 900},
    {"width": 1280, "height": 720},
    {"width": 2560, "height": 1440},
    {"width": 390,  "height": 844},   # iPhone 14
]

STEALTH_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-IN', 'en-US', 'en']});
window.chrome = {runtime: {}};
Object.defineProperty(navigator, 'permissions', {
  get: () => ({query: () => Promise.resolve({state: 'granted'})})
});
"""


async def human_delay(min_ms: int = 500, max_ms: int = 2500) -> None:
    await asyncio.sleep(random.randint(min_ms, max_ms) / 1000.0)


async def short_delay(min_ms: int = 200, max_ms: int = 800) -> None:
    await asyncio.sleep(random.randint(min_ms, max_ms) / 1000.0)


def random_user_agent() -> str:
    return random.choice(USER_AGENTS)


def random_viewport() -> dict:
    return random.choice(VIEWPORTS)


async def apply_stealth(page) -> None:
    await page.add_init_script(STEALTH_SCRIPT)


def get_proxy() -> Optional[str]:
    proxy_list_str = os.getenv("PROXY_LIST", "")
    if not proxy_list_str:
        return None
    proxies = [p.strip() for p in proxy_list_str.split(",") if p.strip()]
    return random.choice(proxies) if proxies else None


async def wayback_fallback(url: str) -> Optional[str]:
    """Async Wayback Machine snapshot fetcher."""
    try:
        check_url = f"https://archive.org/wayback/available?url={quote(url)}"
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(check_url, headers={"User-Agent": random_user_agent()})
            if resp.status_code == 200:
                data = resp.json()
                snapshot = data.get("archived_snapshots", {}).get("closest", {})
                if snapshot.get("available") and snapshot.get("url"):
                    archived_url = snapshot["url"]
                    page_resp = await client.get(
                        archived_url,
                        timeout=15.0,
                        headers={"User-Agent": random_user_agent()},
                    )
                    if page_resp.status_code == 200:
                        logger.info(f"[AntiBlock] Wayback fallback succeeded for {url}")
                        return page_resp.text
    except Exception as exc:
        logger.debug(f"[AntiBlock] Wayback fallback failed for {url}: {exc}")
    return None


async def random_scroll(page, steps: int = 3) -> None:
    for _ in range(steps):
        scroll_y = random.randint(300, 800)
        await page.evaluate(f"window.scrollBy(0, {scroll_y})")
        await short_delay(300, 700)


def retry_http(max_retries: int = 2, backoff_factor: float = 1.5):
    """Decorator to automatically retry failed async HTTP operations."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exc = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if attempt < max_retries:
                        sleep_time = backoff_factor ** attempt + random.uniform(0, 1)
                        logger.debug(f"[Retry] Attempt {attempt+1} failed, retrying in {sleep_time:.1f}s")
                        await asyncio.sleep(sleep_time)
            raise last_exc
        return wrapper
    return decorator
