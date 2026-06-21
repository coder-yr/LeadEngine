import logging
from typing import List, Dict, Optional
import requests
from bs4 import BeautifulSoup
from scraper_utils import is_valid_company_domain, create_standard_record

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

async def scrape_website_search(
    keyword: str,
    city: str,
    max_results: int = 50,
) -> List[Dict[str, Optional[str]]]:
    """
    Scrape DuckDuckGo HTML using site:.in operator for targeted Indian company websites.
    """
    query = f"site:.in \"{keyword}\" \"{city}\""
    url = "https://html.duckduckgo.com/html/"
    
    extracted_data = []
    
    try:
        logger.info(f"Website Search: Searching for '{query}'")
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
                
            title_el = result.find('a', class_='result__url')
            if not title_el:
                continue
                
            href = title_el.get('href', '')
            if href.startswith('//duckduckgo.com/l/?uddg='):
                import urllib.parse
                href = urllib.parse.unquote(href.split('uddg=')[1].split('&')[0])
                
            if not is_valid_company_domain(href):
                continue
                
            title_text_el = result.find('a', class_='result__title')
            title = title_text_el.text.strip() if title_text_el else ""
            
            if not title or not href:
                continue
                
            clean_title = title.split('|')[0].split('-')[0].strip()
            
            record = create_standard_record(
                name=clean_title,
                source="website_search",
                website=href,
                category=keyword
            )
            extracted_data.append(record)
            
        logger.info(f"Website Search: Found {len(extracted_data)} direct company websites")
        return extracted_data
        
    except requests.RequestException as e:
        logger.error(f"Website Search failed: {e}")
        return extracted_data
    except Exception as e:
        logger.error(f"Website Search processing error: {e}")
        return extracted_data
