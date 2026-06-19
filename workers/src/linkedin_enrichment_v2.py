import argparse
import json
import logging
import re
import urllib.parse
import time
from typing import List, Dict, Any

import requests
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS
from googlesearch import search

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# Basic headers to avoid immediate 403s
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

def clean_linkedin_url(url: str) -> str:
    """Normalize LinkedIn URL to remove tracking params."""
    if not url:
        return ""
    # Extract base URL up to the profile name
    match = re.search(r'(https?://[a-z]{0,3}\.?linkedin\.com/in/[^/?#]+)', url)
    return match.group(1) if match else url

def parse_name_title_from_snippet(title_text: str, snippet_text: str, company_name: str) -> tuple:
    """Heuristic to extract name and job title from a search result snippet/title."""
    clean_title = title_text.replace('| LinkedIn', '').replace('- LinkedIn', '').strip()
    
    parts = [p.strip() for p in clean_title.split('-')]
    if '|' in clean_title:
        parts = [p.strip() for p in clean_title.split('|')]
        
    name_part = ""
    job_title = ""
    
    title_keywords = ['ceo', 'founder', 'director', 'manager', 'president', 'vp', 'head', 'doctor', 'psychiatrist', 'psychologist', 'consultant', 'principal', 'owner', 'partner', 'chief']
    
    for part in parts:
        part_lower = part.lower()
        if company_name.lower() in part_lower or part_lower in company_name.lower():
            continue
            
        is_title = any(kw in part_lower for kw in title_keywords)
        
        if is_title and not job_title:
            job_title = part
        elif not name_part and len(part.split()) <= 4:
            name_part = part
            
    if not name_part and len(parts) > 0:
        name_part = parts[0]
        if len(parts) > 1 and not job_title:
            job_title = parts[1]
            
    if not job_title and snippet_text:
        # Try to guess from snippet
        snippet_clean = snippet_text.split('...')[0].strip()
        if snippet_clean and len(snippet_clean) < 50:
            job_title = snippet_clean
            
    return name_part, job_title

def do_duckduckgo_search(company_name: str) -> List[Dict[str, Any]]:
    contacts = []
    queries = [
        f'"{company_name}" founder linkedin',
        f'"{company_name}" CEO linkedin'
    ]
    
    try:
        ddgs = DDGS()
        for query in queries:
            results = ddgs.text(query, max_results=3)
            for r in results:
                url = r.get('href', '')
                if 'linkedin.com/in' not in url:
                    continue
                    
                name, title = parse_name_title_from_snippet(r.get('title', ''), r.get('body', ''), company_name)
                
                if name:
                    contacts.append({
                        "full_name": name,
                        "title": title,
                        "linkedin_url": clean_linkedin_url(url),
                        "company_name": company_name,
                        "source": "DuckDuckGo Search",
                        "confidence": 90 if title else 60
                    })
    except Exception as e:
        logger.error(f"DuckDuckGo error: {e}")
        
    return contacts

def do_google_search(company_name: str) -> List[Dict[str, Any]]:
    contacts = []
    query = f'site:linkedin.com/in "{company_name}"'
    
    try:
        # googlesearch-python yields URLs, we don't get the title/snippet directly without fetching the page
        # but fetching linkedin pages without auth is blocked. We'll just extract the name from the URL
        # and assign a lower confidence.
        urls = search(query, num_results=5, sleep_interval=2.0)
        for url in urls:
            if 'linkedin.com/in' not in url:
                continue
                
            # Extract name from URL e.g. https://www.linkedin.com/in/john-doe-12345/
            match = re.search(r'linkedin\.com/in/([^/]+)', url)
            if match:
                slug = match.group(1)
                # Clean slug: remove numbers at the end, replace dashes with spaces
                slug_clean = re.sub(r'-\d+$', '', slug).replace('-', ' ').title()
                
                contacts.append({
                    "full_name": slug_clean,
                    "title": "", # Unknown from just URL
                    "linkedin_url": clean_linkedin_url(url),
                    "company_name": company_name,
                    "source": "Google Search",
                    "confidence": 60
                })
    except Exception as e:
        logger.error(f"Google Search error: {e}")
        
    return contacts

def crawl_website(company_name: str, website: str) -> List[Dict[str, Any]]:
    contacts = []
    if not website:
        return contacts
        
    if not website.startswith('http'):
        website = f'https://{website}'
        
    paths_to_check = ['/about', '/about-us', '/team', '/our-team', '/leadership']
    found_urls = set([website])
    
    # 1. Fetch homepage to find links
    try:
        resp = requests.get(website, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            for a in soup.find_all('a', href=True):
                href = a['href'].lower()
                for p in paths_to_check:
                    if p in href:
                        full_url = urllib.parse.urljoin(website, a['href'])
                        found_urls.add(full_url)
    except Exception as e:
        logger.error(f"Website homepage fetch error: {e}")
        
    # 2. Extract potential contacts from those pages using simple heuristic
    # (Since we want to avoid Ollama hanging, we use a regex/heuristic approach for standard Team pages)
    title_keywords = ['ceo', 'founder', 'director', 'manager', 'president', 'vp', 'head', 'chief', 'partner']
    
    for url in list(found_urls)[:4]: # Max 4 pages to crawl
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                continue
                
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # Very basic extraction: look for elements containing titles
            # This is a heuristic fallback if Ollama isn't used
            for text_node in soup.stripped_strings:
                text_lower = text_node.lower()
                if any(kw in text_lower for kw in title_keywords) and len(text_node.split()) <= 6:
                    # Look for preceding element which might be the name
                    # In a real scenario, Ollama is much better here, but we'll return a raw hit
                    # For V2, we might rely more heavily on DDG/Google for actual linkedin matches
                    pass
            
            # Another heuristic: find linkedin links on the about/team page
            for a in soup.find_all('a', href=True):
                href = a['href']
                if 'linkedin.com/in/' in href:
                    # Try to get the name from the anchor text
                    name = a.text.strip()
                    if not name:
                        # try parent or previous sibling
                        parent = a.find_parent()
                        if parent:
                            name = parent.text.replace('LinkedIn', '').strip()
                    
                    if name and len(name.split()) <= 4:
                        contacts.append({
                            "full_name": name,
                            "title": "",
                            "linkedin_url": clean_linkedin_url(href),
                            "company_name": company_name,
                            "source": "Website Team Page",
                            "confidence": 100
                        })
                        
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            
    return contacts

def deduplicate_contacts(contacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Deduplicate by linkedin URL or full_name
    seen = {}
    for c in contacts:
        # Key is linkedin url or lowered name
        key = c['linkedin_url'] if c['linkedin_url'] else c['full_name'].lower()
        if not key:
            continue
            
        if key in seen:
            # Keep the one with higher confidence
            if c['confidence'] > seen[key]['confidence']:
                seen[key] = c
            # Merge titles if one is missing
            elif c['title'] and not seen[key]['title']:
                seen[key]['title'] = c['title']
        else:
            seen[key] = c
            
    return list(seen.values())

def main():
    parser = argparse.ArgumentParser(description="Multi-source LinkedIn Enrichment v2")
    parser.add_argument("--company", required=True, help="Company Name")
    parser.add_argument("--website", required=False, default="", help="Company Website URL")
    
    args = parser.parse_args()
    
    contacts = []
    
    # 1. Website Crawler
    if args.website:
        website_contacts = crawl_website(args.company, args.website)
        contacts.extend(website_contacts)
        
    # 2. DuckDuckGo Search
    ddg_contacts = do_duckduckgo_search(args.company)
    contacts.extend(ddg_contacts)
    
    # 3. Google Search
    google_contacts = do_google_search(args.company)
    contacts.extend(google_contacts)
    
    # Deduplicate
    final_contacts = deduplicate_contacts(contacts)
    
    print(json.dumps(final_contacts))

if __name__ == "__main__":
    main()
