import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await ctx.new_page()
        await page.goto('https://www.google.com/maps/search/Cardiologist+mumbai')
        await page.wait_for_timeout(5000)
        
        listings = await page.locator(".hfpxzc").all()
        print(f'Found {len(listings)} listings initially')
        
        if listings:
            listing = listings[0]
            name = await listing.get_attribute('aria-label')
            print(f'Clicking {name}...')
            await listing.click()
            await page.wait_for_timeout(3000)
            print(f'URL after click: {page.url}')
            
            # Try to find the back button
            back_btn = await page.query_selector('button[aria-label="Back"]')
            if back_btn:
                print('Found button[aria-label="Back"]')
            else:
                back_btn = await page.query_selector('button[jsaction*="back"]')
                if back_btn:
                    print('Found button with jsaction back')
                    
            # Let's try page.go_back()
            print('Trying page.go_back()...')
            await page.go_back()
            await page.wait_for_timeout(2000)
            print(f'URL after go_back: {page.url}')
            
            # Try clicking the second listing
            listing2 = listings[1]
            name2 = await listing2.get_attribute('aria-label')
            print(f'Clicking {name2}...')
            await listing2.click(timeout=2000)
            print('Successfully clicked second listing!')
            
        await browser.close()

asyncio.run(main())
