import logging
from crawl4ai import AsyncWebCrawler

logger = logging.getLogger(__name__)

async def crawl(url: str) -> dict:
    """
    Asynchronously crawls a URL and returns its markdown representation using Crawl4AI.
    
    Args:
        url (str): The target URL to crawl.
        
    Returns:
        dict: A dictionary containing the extracted markdown.
    """
    logger.info(f"Crawling URL: {url}")
    
    try:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)
            
            return {
                "markdown": result.markdown
            }
    except Exception as e:
        logger.error(f"Failed to crawl {url}: {e}")
        raise
