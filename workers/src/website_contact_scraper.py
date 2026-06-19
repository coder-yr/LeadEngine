import os
import json
import logging
import argparse
import sys
import types
from typing import List, Optional
from pydantic import BaseModel, Field

# Patch for scrapegraphai to fix ChatOllama import from langchain_community
try:
    import langchain_ollama
    if "langchain_community.chat_models" not in sys.modules:
        chat_models_module = types.ModuleType("langchain_community.chat_models")
        chat_models_module.ChatOllama = langchain_ollama.ChatOllama
        sys.modules["langchain_community.chat_models"] = chat_models_module
except ImportError:
    pass

from scrapegraphai.graphs import SmartScraperGraph
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

class ContactExtraction(BaseModel):
    first_name: Optional[str] = Field(None, description="First name of the person")
    last_name: Optional[str] = Field(None, description="Last name of the person")
    title: Optional[str] = Field(None, description="Job title (e.g. CEO, Founder, Director, Manager)")
    department: Optional[str] = Field(None, description="Department (if applicable)")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")

class TeamExtraction(BaseModel):
    contacts: List[ContactExtraction] = Field(default_factory=list, description="List of leadership team members")

def extract_website_contacts(url: str) -> List[dict]:
    """
    Extracts leadership team contacts from a given URL using ScrapeGraphAI.
    """
    logger.info(f"Starting ScrapeGraphAI contact extraction for: {url}")
    
    llm_model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
    llm_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    
    if openai_api_key:
        graph_config = {
            "llm": {
                "api_key": openai_api_key,
                "model": "openai/gpt-4o-mini",
            },
            "verbose": False,
            "headless": True
        }
    else:
        graph_config = {
            "llm": {
                "model": f"ollama/{llm_model}",
                "base_url": llm_base_url,
            },
            "embeddings": {
                "model": "ollama/nomic-embed-text",
                "base_url": llm_base_url,
            },
            "verbose": False,
            "headless": True
        }

    prompt = (
        "Extract the leadership team and decision makers (Founder, Co-Founder, CEO, Chief, Owner, Director, Manager) "
        "from this company website. For each person, extract their first name, last name, job title, "
        "department, linkedin url, email address, and phone number if available. "
        "If a person's exact title isn't listed but they appear to be leadership, include them."
    )

    def scrape_url(target_url: str) -> List[dict]:
        try:
            smart_scraper_graph = SmartScraperGraph(
                prompt=prompt,
                source=target_url,
                config=graph_config,
                schema=TeamExtraction
            )
            
            result = smart_scraper_graph.run()
            
            extracted = []
            if isinstance(result, TeamExtraction):
                extracted = result.contacts
            elif isinstance(result, dict) and 'contacts' in result:
                extracted = result['contacts']
                
            out = []
            for c in extracted:
                if hasattr(c, 'model_dump'):
                    out.append(c.model_dump())
                elif isinstance(c, dict):
                    out.append(c)
            return out
        except Exception as e:
            logger.error(f"Failed to extract contacts from {target_url} using ScrapeGraphAI: {e}")
            return []

    # Find candidate pages
    candidate_urls = [url]
    try:
        response = requests.get(url, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        keywords = ['about', 'team', 'leadership', 'management', 'founder', 'director', 'staff', 'expert']
        
        for a in soup.find_all('a', href=True):
            href = a['href'].lower()
            if any(kw in href for kw in keywords):
                full_url = urljoin(url, a['href'])
                if urlparse(full_url).netloc == urlparse(url).netloc:
                    if full_url not in candidate_urls:
                        candidate_urls.append(full_url)
    except Exception as e:
        logger.error(f"Error fetching homepage links for {url}: {e}")

    # Limit to top 3 pages to avoid excessive LLM calls
    candidate_urls = candidate_urls[:3]
    
    all_contacts = []
    seen = set()
    for curl in candidate_urls:
        logger.info(f"Scraping candidate URL: {curl}")
        contacts = scrape_url(curl)
        for c in contacts:
            name = f"{c.get('first_name','')} {c.get('last_name','')}".strip().lower()
            if name and name not in seen:
                seen.add(name)
                all_contacts.append(c)
                
    return all_contacts

def main():
    parser = argparse.ArgumentParser(description="Scrape contact information from a company website using ScrapeGraphAI.")
    parser.add_argument("--website", required=True, help="Company Website URL")
    
    args = parser.parse_args()
    
    # Ensure it starts with http
    url = args.website
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url
        
    contacts = extract_website_contacts(url)
    print(json.dumps(contacts))

if __name__ == "__main__":
    main()
