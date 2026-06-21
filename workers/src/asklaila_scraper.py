import logging
import time
from typing import List, Dict, Optional
import requests
from bs4 import BeautifulSoup
from scraper_utils import create_standard_record
import urllib.parse

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

async def scrape_asklaila(
    keyword: str,
    city: str,
    max_results: int = 50,
) -> List[Dict[str, Optional[str]]]:
    """
    Scrape AskLaila for business listings.
    """
    extracted_data = []
    
    query = f"site:asklaila.com {keyword} {city}"
    url = "https://html.duckduckgo.com/html/"
    
    try:
        logger.info(f"AskLaila: Searching for '{query}'")
        import urllib.parse
        encoded_query = urllib.parse.quote(query)
        search_url = f"{url}?q={encoded_query}"
        
        headers = HEADERS.copy()
        headers["Referer"] = "https://duckduckgo.com/"
        
        response = requests.get(search_url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        results = soup.find_all('div', class_='result')
        
        for result in results:
            if len(extracted_data) >= max_results:
                break
                
            title_el = result.find('a', class_='result__title')
            url_el = result.find('a', class_='result__url')
            snippet_el = result.find('a', class_='result__snippet')
            
            if not title_el or not url_el:
                continue
                
            href = url_el.get('href', '')
            if href.startswith('//duckduckgo.com/l/?uddg='):
                href = urllib.parse.unquote(href.split('uddg=')[1].split('&')[0])
                
            title = title_el.text.strip()
            snippet = snippet_el.text.strip() if snippet_el else ""
            
            import re
            phones = re.findall(r'[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]', snippet)
            phone = phones[0].strip() if phones else None
            
            clean_title = title.split(' in ')[0].split('-')[0].split(',')[0].strip()
            
            record = create_standard_record(
                name=clean_title,
                source="asklaila",
                website="",
                phone=phone,
                address=city,
                category=keyword
            )
            extracted_data.append(record)
            
        logger.info(f"AskLaila: Found {len(extracted_data)} listings")
        return extracted_data
        
    except Exception as e:
        logger.error(f"AskLaila scraping error: {e}")
        return extracted_data
