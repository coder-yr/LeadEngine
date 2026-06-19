import asyncio
import json
import argparse
import logging
import urllib.parse
from typing import List, Dict, Any

from playwright.async_api import async_playwright

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

async def scrape_contacts(company_name: str, website: str = "") -> List[Dict[str, Any]]:
    """
    Search DuckDuckGo HTML for LinkedIn profiles of the company's decision makers.
    """
    contacts = []
    
    # We query DuckDuckGo for LinkedIn profiles
    # Search term: site:linkedin.com/in "Company Name" (CEO OR Founder OR Director OR Manager)
    query = f'site:linkedin.com/in "{company_name}" (CEO OR Founder OR Director OR Manager OR President OR VP OR "Managing Director" OR Head)'
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # DuckDuckGo HTML uses .result elements
            results = await page.locator('.result').all()
            
            for res in results:
                try:
                    title_elem = res.locator('.result__title a.result__url')
                    title_text = await title_elem.text_content()
                    if not title_text:
                        continue
                    
                    href = await title_elem.get_attribute('href')
                    if not href:
                        continue
                    
                    snippet_elem = res.locator('.result__snippet')
                    snippet_text = await snippet_elem.text_content() or ""
                    
                    # Clean and split the title
                    clean_title = title_text.replace('| LinkedIn', '').replace('- LinkedIn', '').strip()
                    
                    # Split by | or -
                    if '|' in clean_title:
                        parts = [p.strip() for p in clean_title.split('|')]
                    else:
                        parts = [p.strip() for p in clean_title.split('-')]
                        
                    name_part = ""
                    job_title = ""
                    
                    # Heuristics to find Name and Title
                    # Often it's Name - Title - Company or Company - Name - Title
                    # Let's find the part that looks like a name (usually 2-3 words) and the part that looks like a title
                    for part in parts:
                        part_lower = part.lower()
                        # If it matches company name closely, skip
                        if company_name.lower() in part_lower or part_lower in company_name.lower():
                            continue
                            
                        # If it contains title keywords, it's the title
                        title_keywords = ['ceo', 'founder', 'director', 'manager', 'president', 'vp', 'head', 'doctor', 'psychiatrist', 'psychologist', 'consultant', 'principal', 'owner', 'partner', 'chief']
                        is_title = any(kw in part_lower for kw in title_keywords)
                        
                        if is_title and not job_title:
                            job_title = part
                        elif not name_part and len(part.split()) <= 4:
                            name_part = part
                            
                    if not name_part:
                        # Fallback if heuristics failed
                        name_part = parts[0] if len(parts) > 0 else ""
                        if len(parts) > 1 and not job_title:
                            job_title = parts[1]
                            
                    # Split name into first/last
                    name_tokens = name_part.split(' ')
                    first_name = name_tokens[0] if name_tokens else ""
                    last_name = " ".join(name_tokens[1:]) if len(name_tokens) > 1 else ""
                    
                    # If job title is empty, maybe try to guess from snippet
                    if not job_title and snippet_text:
                        # Extract first few words from snippet
                        snippet_clean = snippet_text.split('...')[0].strip()
                        if snippet_clean and len(snippet_clean) < 50:
                            job_title = snippet_clean
                    
                    contacts.append({
                        "first_name": first_name,
                        "last_name": last_name,
                        "title": job_title,
                        "department": None,
                        "linkedin_url": href if "linkedin.com/in" in href else None,
                        "email": None,
                        "phone": None
                    })
                    
                except Exception as e:
                    logger.debug(f"Error parsing result: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error during DuckDuckGo search: {e}")
        finally:
            await browser.close()
            
    return contacts

async def main():
    parser = argparse.ArgumentParser(description="Scrape contact information for a company.")
    parser.add_argument("--company", required=True, help="Company Name")
    parser.add_argument("--website", required=False, default="", help="Company Website URL")
    
    args = parser.parse_args()
    
    contacts = await scrape_contacts(args.company, args.website)
    print(json.dumps(contacts))

if __name__ == "__main__":
    asyncio.run(main())
