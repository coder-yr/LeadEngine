import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "https://html.duckduckgo.com/html/?q=site:justdial.com+%22dentist%22+%22mumbai%22"
        await page.goto(url)
        
        # Wait a bit to see if we get the results
        await page.wait_for_timeout(2000)
        
        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")
        
        results = soup.find_all("div", class_="result")
        print(f"Found {len(results)} results")
        for r in results[:2]:
            a = r.find("a", class_="result__url")
            print(a.get("href") if a else "No url")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
