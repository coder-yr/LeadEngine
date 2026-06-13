import os
import json
import ssl
import socket
import logging
import requests
from typing import List, Optional, Tuple
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

# Patch for langchain_community compatibility if needed
import sys
import types
try:
    import langchain_ollama
    if "langchain_community.chat_models" not in sys.modules:
        chat_models_module = types.ModuleType("langchain_community.chat_models")
        chat_models_module.ChatOllama = langchain_ollama.ChatOllama
        sys.modules["langchain_community.chat_models"] = chat_models_module
except ImportError:
    pass

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

logger = logging.getLogger(__name__)

class AuditScore(BaseModel):
    overall: int = Field(description="Overall audit score 0-100")
    performance: int = Field(description="Performance score 0-100")
    seo: int = Field(description="SEO score 0-100")

class AuditResult(BaseModel):
    url: str
    ssl_valid: bool
    mobile_friendly: bool
    page_speed_score: int
    has_contact_form: bool
    has_whatsapp_widget: bool
    score: AuditScore
    recommendations: List[str]

class LLMWidgetDetection(BaseModel):
    has_contact_form: bool = Field(description="True if the website has a contact form")
    has_whatsapp_widget: bool = Field(description="True if the website has a WhatsApp link or widget")

def check_ssl(url: str) -> bool:
    try:
        parsed_url = urlparse(url)
        hostname = parsed_url.hostname
        if not hostname:
            return False
            
        context = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                return bool(cert)
    except Exception as e:
        logger.warning(f"SSL Check failed for {url}: {e}")
        return False

def check_pagespeed(url: str) -> Tuple[int, bool]:
    # Returns (performance_score, mobile_friendly)
    try:
        api_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&strategy=mobile"
        response = requests.get(api_url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            lighthouse = data.get("lighthouseResult", {})
            categories = lighthouse.get("categories", {})
            
            perf_score = int(categories.get("performance", {}).get("score", 0) * 100)
            
            # Rough proxy for mobile friendly: performance checks for mobile strategy passed
            mobile_friendly = perf_score > 30
            
            return perf_score, mobile_friendly
            
        return 0, False
    except Exception as e:
        logger.warning(f"PageSpeed API failed for {url}: {e}")
        return 0, False

def extract_and_detect_content(url: str) -> Tuple[int, bool, bool]:
    """
    Returns (seo_score, has_contact_form, has_whatsapp)
    """
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # SEO Checks
        seo_score = 0
        title = soup.find('title')
        if title and title.text.strip():
            seo_score += 40
            
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content', '').strip():
            seo_score += 40
            
        h1 = soup.find('h1')
        if h1 and h1.text.strip():
            seo_score += 20
            
        # Basic heuristic for WhatsApp (fast check)
        wa_heuristic = False
        html_str = response.text.lower()
        if 'wa.me' in html_str or 'api.whatsapp.com' in html_str or 'whatsapp' in html_str:
            wa_heuristic = True
            
        # Extract text snippets and links to pass to LLM
        links = [a.get('href', '') for a in soup.find_all('a', href=True)][:50]
        forms = [str(f)[:200] for f in soup.find_all('form')][:5]
        
        content_summary = {
            "links": links,
            "forms_preview": forms,
            "whatsapp_mentioned": wa_heuristic
        }
        
        # Use LLM to definitively detect
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if openai_api_key:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(model="gpt-4o-mini", api_key=openai_api_key, temperature=0)
        else:
            from langchain_ollama import ChatOllama
            llm_model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
            llm_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            llm = ChatOllama(model=llm_model, base_url=llm_base_url, temperature=0, format="json")

        parser = JsonOutputParser(pydantic_object=LLMWidgetDetection)
        prompt_template = """
        You are a website auditor. Based on the following HTML snippets and metadata extracted from a website, 
        determine if the website has a Contact Form and if it has a WhatsApp Widget or link.
        
        Website data:
        {data}
        
        {format_instructions}
        """
        prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["data"],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        chain = prompt | llm | parser
        
        detection = chain.invoke({"data": json.dumps(content_summary)})
        
        has_form = detection.get("has_contact_form", False)
        has_wa = detection.get("has_whatsapp_widget", False)
        
        # Fallback to heuristic if LLM misses obvious WhatsApp
        if wa_heuristic and not has_wa:
            has_wa = True
            
        return seo_score, has_form, has_wa
        
    except Exception as e:
        logger.warning(f"Content extraction failed for {url}: {e}")
        return 0, False, False

def audit_website(url: str) -> AuditResult:
    logger.info(f"Starting audit for: {url}")
    
    if not url.startswith('http'):
        url = 'https://' + url
        
    ssl_valid = check_ssl(url)
    perf_score, mobile_friendly = check_pagespeed(url)
    seo_score, has_contact_form, has_whatsapp = extract_and_detect_content(url)
    
    # Calculate overall score
    # Weights: Perf 30%, SEO 30%, SSL 10%, Mobile 10%, Widgets 20%
    overall = (perf_score * 0.3) + (seo_score * 0.3) + (10 if ssl_valid else 0) + (10 if mobile_friendly else 0)
    if has_contact_form: overall += 10
    if has_whatsapp: overall += 10
    
    overall = min(100, int(overall))
    
    recommendations = []
    if not ssl_valid:
        recommendations.append("Install an SSL certificate to secure the website and improve trust.")
    if perf_score < 50:
        recommendations.append("Optimize website performance and page load speed. Consider image compression and caching.")
    if seo_score < 100:
        recommendations.append("Improve on-page SEO by ensuring proper title tags, meta descriptions, and H1 tags.")
    if not mobile_friendly:
        recommendations.append("Improve mobile responsiveness to ensure a good experience on smartphones.")
    if not has_contact_form:
        recommendations.append("Add a contact form to capture lead information easily.")
    if not has_whatsapp:
        recommendations.append("Integrate a WhatsApp widget for direct and quick customer communication.")
        
    if not recommendations:
        recommendations.append("Website is well optimized. Continue monitoring performance.")
        
    result = AuditResult(
        url=url,
        ssl_valid=ssl_valid,
        mobile_friendly=mobile_friendly,
        page_speed_score=perf_score,
        has_contact_form=has_contact_form,
        has_whatsapp_widget=has_whatsapp,
        score=AuditScore(
            overall=overall,
            performance=perf_score,
            seo=seo_score
        ),
        recommendations=recommendations
    )
    
    return result
