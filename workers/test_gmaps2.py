import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await ctx.new_page()
        await page.goto('https://www.google.com/maps/search/Cardiologist+mumbai')
        await page.wait_for_timeout(5000)
        
        # Scroll to bottom a few times
        for _ in range(3):
            await page.evaluate('''const f = document.querySelector('div[role="feed"]'); if (f) f.scrollTop = f.scrollHeight;''')
            await page.wait_for_timeout(2000)
            
        listings = await page.locator(".hfpxzc, a[href*='/maps/place/']").all()
        print(f'Found {len(listings)} listings')
        
        successes = 0
        seen_names = set()
        for i, listing in enumerate(listings[:30]):
            try:
                name = await listing.get_attribute('aria-label', timeout=1000)
                if not name:
                    print(f'Listing {i}: no name')
                    continue
                    
                name_key = name.strip().lower()
                if name_key in seen_names:
                    print(f'Listing {i}: dup name {name_key}')
                    continue
                seen_names.add(name_key)

                print(f'Listing {i}: name={name}')
                
                await listing.scroll_into_view_if_needed(timeout=1000)
                await listing.click(timeout=1000)
                await page.wait_for_timeout(1000)
                
                # Check if we can find something in the panel
                rating_el = await page.query_selector('span[aria-label*="stars"]')
                if rating_el:
                    label = await rating_el.get_attribute("aria-label")
                    print(f'  -> Rating: {label}')
                else:
                    print('  -> No rating found')
                    
                successes += 1
            except Exception as e:
                print(f'Listing {i} Failed: {e}')
                
        print(f'Successes: {successes}')
        await browser.close()

asyncio.run(main())
