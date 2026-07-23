import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://www.google.com/maps/search/Cardiologist+mumbai')
        await page.wait_for_timeout(5000)
        
        # Scroll to bottom a few times
        for _ in range(5):
            await page.evaluate('''const f = document.querySelector('div[role="feed"]'); if (f) f.scrollTop = f.scrollHeight;''')
            await page.wait_for_timeout(2000)
            
        listings = await page.locator('.hfpxzc').all()
        print(f'Found {len(listings)} listings')
        
        successes = 0
        for i, listing in enumerate(listings[:20]):
            name = await listing.get_attribute('aria-label')
            print(f'Listing {i}: name={name}')
            try:
                await listing.scroll_into_view_if_needed(timeout=1000)
                await listing.click(timeout=1000)
                await page.wait_for_timeout(1000)
                print('Clicked successfully')
                successes += 1
            except Exception as e:
                print(f'Click failed: {e}')
                
        print(f'Successes: {successes}/20')
        await browser.close()

asyncio.run(main())
