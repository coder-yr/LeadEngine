import asyncio
import time
from playwright.async_api import async_playwright
import requests

async def main():
    url = "https://sabkadentist.com"
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent="Mozilla/5.0")
            page = await context.new_page()
            await page.goto(url, timeout=15000, wait_until="domcontentloaded")
            html = await page.content()
            await browser.close()
            with open("sabka_playwright.html", "w", encoding="utf-8") as f:
                f.write(html)
            print(f"Playwright downloaded {len(html)} bytes")
    except Exception as e:
        print(f"Playwright error: {e}")

asyncio.run(main())
