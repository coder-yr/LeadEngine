import logging
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

async def crawl(url: str) -> dict:
    """
    Asynchronously crawls a URL and returns its text representation using Playwright and BeautifulSoup.
    
    Args:
        url (str): The target URL to crawl.
        
    Returns:
        dict: A dictionary containing the extracted markdown.
    """
    if not url.startswith('http'):
        url = 'https://' + url
        
    logger.info(f"Crawling URL: {url}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # Use domcontentloaded to speed up crawling
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            html = await page.content()
            await browser.close()
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove scripts, styles, and boilerplate elements
            for el in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                el.decompose()
                
            text = soup.get_text(separator='\n')
            
            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            clean_text = '\n'.join(chunk for chunk in chunks if chunk)
            
            return {
                "markdown": clean_text
            }
    except Exception as e:
        logger.error(f"Failed to crawl {url}: {e}")
        # Return empty rather than crashing the pipeline if a single site fails
        return {
            "markdown": ""
        }
