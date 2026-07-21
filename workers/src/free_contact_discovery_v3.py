import argparse
import json
import logging
import re
import urllib.parse
import time
import sys
from typing import List, Dict, Any, Set, Tuple

import requests
from bs4 import BeautifulSoup
import ollama
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

GLOBAL_METRICS = {
    "rawTextNodesScanned": 0,
    "profileContainersDetected": 0,
    "candidatesGenerated": 0,
    "candidatesRejectedPreGeneration": 0,
    "candidatesRejectedAsPhone": 0,
    "candidatesRejectedAsCTA": 0,
    "candidatesRejectedAsMarketing": 0,
    "candidatesRejectedAsPlaceholder": 0,
    "rejectedAsProductNames": 0,        # V5.1 Phase 3
    "sectionLabelsRejected": 0,
    "linkedinOwnershipFailures": 0,
    "fallbackCandidatesFound": 0,
    "fallbackCandidatesValidated": 0,
    "fallbackCandidatesRejected": 0,
    "fallbackBlocksScanned": 0,
    "footerDetected": False,
    "footerEmailsFound": 0,
    "footerPhonesFound": 0,
    "footerAddressesFound": 0,
    "socialProfilesFound": 0,
    "contactPagesFound": 0
}

def looks_like_human_name(name: str) -> bool:
    if not name or len(name) < 3 or len(name) > 40:
        return False
    parts = name.split()
    if len(parts) < 2 or len(parts) > 4:
        return False
    alpha_parts = [p for p in parts if re.search(r'[A-Za-z]', p)]
    if len(alpha_parts) < 2:
        return False
    for p in alpha_parts:
        if p[0].islower() and p.lower() not in ['van', 'de', 'der', 'von', 'la', 'del', 'da', 'di']:
            return False
    return True

# V5.1 Phase 3: Product/platform/feature term blacklist for pre-gen rejection
PRODUCT_TERMS_PY = {
    # Software product names
    'crm', 'analytics', 'vault', 'publish', 'oneauth', 'books', 'creator',
    'mail', 'desk', 'assist', 'campaign', 'workflow', 'automation',
    # Platform / Infrastructure
    'platform', 'product', 'service', 'solution', 'suite', 'cloud', 'hub',
    'studio', 'portal', 'engine', 'framework', 'api', 'sdk', 'plugin',
    # Action / Setup words that appear as product names
    'setup', 'guide', 'install', 'deploy', 'configure', 'integrate',
    'dashboard', 'console', 'panel', 'module', 'extension',
    # SaaS product names
    'invoice', 'inventory', 'recruit', 'survey', 'connect', 'cliq',
    'meeting', 'webinar', 'sign', 'learn', 'projects', 'sprints', 'bigin',
    'catalyst', 'appsmith', 'qengine', 'orchestly', 'directory',
    # Generic product categories
    'software', 'tool', 'system', 'payment', 'billing', 'subscription',
    'enterprise', 'professional', 'premium', 'ultimate', 'basic', 'starter',
}

REJECT_KEYWORDS_PY = {
    'company', 'agency', 'services', 'centre', 'center', 
    'foundation', 'associates', 'pvt ltd', 'private limited', 
    'group', 'support', 'info', 'hello', 'contact', 'admin', 'sales',
    'llc', 'inc', 'ltd', 'limited', 'corporation', 'corp', 'team',
    'office', 'help', 'no-reply', 'noreply', 'billing', 'accounts',
    'systems', 'technologies', 'technology', 'solutions', 'networks', 
    'ventures', 'capital', 'holdings', 'industry', 'industries', 
    'enterprise', 'enterprises', 'partner', 'partners', 'consulting', 
    'consultancy', 'academy', 'institute', 'institutes', 'university', 
    'college', 'school', 'schools', 'trust', 'board', 'council', 
    'clinic', 'clinics', 'hospital', 'hospitals', 'dental', 'medical', 
    'healthcare', 'care', 'therapy', 'therapies', 'wellness', 'studio', 
    'studios', 'lab', 'labs', 'hub', 'hubs', 'club', 'clubs', 'society', 
    'association', 'alliance', 'network', 'brand', 'brands', 'app', 
    'apps', 'application', 'applications', 'device', 'devices', 
    'hardware', 'equipment', 'material', 'materials', 'goods', 'item', 
    'items', 'press', 'media', 'news', 'blog', 'forum', 'channel', 
    'channels', 'publish', 'publishing', 'publication', 'publications',
    'award', 'awards', 'prize', 'prizes', 'medal', 'medals', 'honour', 
    'honours', 'honor', 'honors', 'shri', 'padma', 'ratna', 'nobel',
    'coach', 'coaches', 'coaching', 'train', 'trainer', 'trainers', 
    'training', 'course', 'courses', 'class', 'classes'
}

DOMAIN_TOKEN = ""

def get_domain_token(url: str) -> str:
    try:
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc or url
        netloc = netloc.replace('www.', '')
        parts = netloc.split('.')
        if len(parts) > 0:
            token = parts[0].lower()
            if len(token) > 2 and token != 'www':
                return token
    except:
        pass
    return ""

def has_brand_casing(word: str) -> bool:
    if re.search(r'[a-z][A-Z]', word):
        if re.match(r'^(mac|mc)[A-Z]', word, re.IGNORECASE):
            return False
        return True
    return False

def calculate_pre_gen_score(name: str, title: str, section_type: str, has_image: bool, has_linkedin: bool, has_email: bool, has_phone: bool) -> Tuple[int, str]:
    score = 0
    lower_name = name.lower().strip()
    name_words = re.split(r'[\s]+', lower_name)
    
    # 1. Domain token branding check
    if DOMAIN_TOKEN and DOMAIN_TOKEN in name_words:
        GLOBAL_METRICS["rejectedAsProductNames"] += 1
        return -100, "PRODUCT_NAME"

    # 2. Country suffix branding check
    if len(name_words) >= 2:
        last_word = name_words[-1]
        if last_word in ['india', 'uk', 'us', 'usa', 'uae']:
            GLOBAL_METRICS["rejectedAsProductNames"] += 1
            return -100, "PRODUCT_NAME"

    # 3. Reject product/feature/platform names at the Python level
    for word in name_words:
        clean_word = re.sub(r'[^a-z]', '', word)
        if len(clean_word) > 1 and clean_word in PRODUCT_TERMS_PY:
            GLOBAL_METRICS["rejectedAsProductNames"] += 1
            return -100, "PRODUCT_NAME"
            
        # 5. Reject Keyword check
        if clean_word in REJECT_KEYWORDS_PY:
            GLOBAL_METRICS["rejectedAsProductNames"] += 1
            return -100, "PRODUCT_NAME"
            
    # 4. Brand Casing Check
    orig_words = name.strip().split()
    for ow in orig_words:
        if has_brand_casing(ow):
            GLOBAL_METRICS["rejectedAsProductNames"] += 1
            return -100, "PRODUCT_NAME"

    # 6. Title Quality Check
    if title:
        title_lower = title.lower().strip()
        if len(title_lower) > 80:
            return -100, "CTA"
        descriptive_phrases = ['to help', 'insights that', 'our client', 'we are', 'helping you', 'award on', 'award—on', 'on our', 'for our', 'from our']
        if any(phrase in title_lower for phrase in descriptive_phrases):
            return -100, "CTA"
        words_title = title_lower.split()
        if len(words_title) > 8 and not any(kw in title_lower for kw in ['director of', 'head of', 'vice president of']):
            return -100, "CTA"
            
    if looks_like_human_name(name): score += 40
    if title: score += 30
    if section_type == 'PROFILE_CARD': score += 25
    if section_type == 'LEADERSHIP_SECTION': score += 25
    if section_type == 'TEAM_SECTION': score += 25
    if section_type == 'AUTHOR_CARD': score += 15
    if section_type == 'TESTIMONIAL_CARD': score += 15
    if has_linkedin: score += 20
    if has_email: score += 20
    if has_image: score += 15
    
    if re.match(r'^[\d\s\+\-\(\)]+$', lower_name) or '@' in lower_name:
        return -100, "PHONE"
        
    cta_phrases = ["call now", "book now", "get started", "learn more", "contact us", "schedule call", "read more", "click here", "subscribe", "download", "sign up", "register", "get a quote", "book appointment"]
    for cta in cta_phrases:
        if cta in lower_name:
            return -100, "CTA"
            
    marketing_phrases = ["trusted experts", "client outcomes", "web development", "paid advertising", "content creation", "braces & aligners", "precision over volume", "radical transparency", "why choose us", "our approach", "our process", "case studies", "success stories", "our origin", "how we win"]
    for mp in marketing_phrases:
        if mp in lower_name:
            return -80, "MARKETING"
            
    placeholders = ["business contact", "contact person", "support team", "admin team", "our team", "about us", "services", "products", "pricing", "solutions", "partners"]
    for p in placeholders:
        if p in lower_name:
            return -80, "PLACEHOLDER"
            
    if section_type in ['SERVICE_SECTION', 'FAQ_SECTION', 'FEATURE_SECTION', 'CTA_SECTION']:
        return -80, "MARKETING"
        
    return score, ""

def get_domain(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).netloc
    except:
        return ""

def is_valid_link(link: str, base_domain: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(link)
        if parsed.netloc and parsed.netloc != base_domain:
            return False
        if any(link.lower().endswith(ext) for ext in ['.pdf', '.jpg', '.png', '.mp4', '.zip', '.css', '.js']):
            return False
        return True
    except:
        return False

def score_link(path: str) -> int:
    path = path.lower()
    score = 0
    keywords = ['about', 'team', 'leadership', 'management', 'founder', 'staff', 'people', 'board', 'author', 'company', 'contact']
    for kw in keywords:
        if kw in path:
            score += 10
    if len(path) < 20:
        score += 2
    return score

def map_section_type(classes: str, block_id: str) -> str:
    text = (classes + " " + block_id).lower()
    
    neg_score = 0
    neg_kw = ['service', 'solution', 'feature', 'faq', 'pricing', 'plan', 'product', 'resource', 'benefit', 'blog', 'industry', 'case-study', 'hero', 'banner', 'cta']
    for kw in neg_kw:
        if kw in text:
            neg_score += 10
            
    if neg_score > 0:
        if 'service' in text or 'solution' in text: return 'SERVICE_SECTION'
        if 'faq' in text: return 'FAQ_SECTION'
        if 'feature' in text: return 'FEATURE_SECTION'
        if 'cta' in text or 'banner' in text or 'hero' in text: return 'CTA_SECTION'
        return 'UNKNOWN'
        
    team_kw = ['team', 'staff', 'employee', 'people']
    leader_kw = ['leadership', 'management', 'founder', 'executive', 'board', 'director']
    profile_kw = ['profile', 'author', 'speaker', 'advisor', 'partner', 'doctor', 'specialist', 'consultant']
    testimonial_kw = ['testimonial', 'review']
    
    for kw in team_kw:
        if kw in text: return 'TEAM_SECTION'
    for kw in leader_kw:
        if kw in text: return 'LEADERSHIP_SECTION'
    for kw in profile_kw:
        if kw in text: return 'PROFILE_CARD'
    for kw in testimonial_kw:
        if kw in text: return 'TESTIMONIAL_CARD'
        
    return 'UNKNOWN'

TITLES = [
    'founder', 'ceo', 'coo', 'cto', 'cfo', 'cmo', 'director', 'president', 'vp', 
    'manager', 'head', 'lead', 'executive', 'officer', 'partner', 'owner', 'chairperson'
]

OCCUPATIONS = [
    'engineer', 'developer', 'designer', 'consultant', 'specialist', 'advisor',
    'psychologist', 'therapist', 'doctor', 'dentist', 'orthodontist', 'clinician',
    'assistant', 'coordinator', 'administrator', 'analyst', 'strategist', 'architect'
]

def fallback_scanner(soup: BeautifulSoup, source_url: str, seen: Set[str]) -> List[Dict[str, Any]]:
    candidates = []
    
    for container in soup.find_all(['div', 'article', 'section', 'li']):
        text_content = container.get_text(separator='|', strip=True)
        if not text_content or len(text_content) > 300:
            continue
            
        GLOBAL_METRICS["fallbackBlocksScanned"] += 1
        
        raw_texts = re.split(r'[\|,—–\n]', text_content)
        texts = [t.strip() for t in raw_texts if t.strip()]
        if len(texts) < 2 or len(texts) > 10:
            continue
            
        has_linkedin = bool(container.find('a', href=lambda x: x and 'linkedin.com/in/' in x))
        has_image = bool(container.find('img'))
        has_email = bool(container.find('a', href=lambda x: x and x.startswith('mailto:')))
        has_phone = bool(container.find('a', href=lambda x: x and x.startswith('tel:')))
        
        is_profile_style = has_image and (has_linkedin or len(texts) <= 5)
        
        for i, name_cand in enumerate(texts):
            if not looks_like_human_name(name_cand):
                continue
                
            name_words = set(re.findall(r'\b\w+\b', name_cand.lower()))
            if name_words.intersection(set(TITLES + OCCUPATIONS)):
                continue
                
            nearby_indices = []
            for offset in [1, -1, 2, -2]:
                j = i + offset
                if 0 <= j < len(texts):
                    nearby_indices.append(j)
                    
            title_cand = ""
            has_title = False
            has_occupation = False
            
            for j in nearby_indices:
                t = texts[j]
                t_lower = t.lower()
                if any(kw in t_lower for kw in ['call now', 'book appointment', 'contact us', 'learn more']):
                    continue
                
                if any(kw in t_lower for kw in TITLES):
                    has_title = True
                    if not title_cand: title_cand = t
                if any(kw in t_lower for kw in OCCUPATIONS):
                    has_occupation = True
                    if not title_cand: title_cand = t
            
            GLOBAL_METRICS["fallbackCandidatesFound"] += 1
            
            score_res, reject_reason = calculate_pre_gen_score(name_cand, title_cand, "FALLBACK", False, False, False, False)
            if reject_reason:
                GLOBAL_METRICS["fallbackCandidatesRejected"] += 1
                continue
                
            # Professional Context Score
            score = 0
            if has_title: score += 20
            if has_occupation: score += 15
            if has_linkedin: score += 20
            if has_image: score += 15
            if len(texts) <= 5: score += 20 # Profile-style container text density
            if has_email: score += 10
            if has_phone: score += 10
            
            if score >= 40:
                key = name_cand.lower()
                if key not in seen:
                    seen.add(key)
                    
                    linkedin_a = container.find('a', href=lambda x: x and 'linkedin.com/in/' in x)
                    linkedin_url = linkedin_a.get('href') if linkedin_a else None
                    
                    email_a = container.find('a', href=lambda x: x and x.startswith('mailto:'))
                    email_url = email_a.get('href').replace('mailto:', '').split('?')[0].strip() if email_a else None
                    
                    phone_a = container.find('a', href=lambda x: x and x.startswith('tel:'))
                    phone_url = phone_a.get('href').replace('tel:', '').strip() if phone_a else None
                    
                    candidates.append({
                        "name": name_cand,
                        "title": title_cand,
                        "sectionType": "FALLBACK_RELATIONSHIP_SCAN",
                        "hasImage": has_image,
                        "hasLinkedin": has_linkedin,
                        "hasEmail": has_email,
                        "hasPhone": has_phone,
                        "sourceUrl": source_url,
                        "linkedin": linkedin_url,
                        "email": email_url,
                        "phone": phone_url,
                        "extractionMethod": "FALLBACK_RELATIONSHIP_SCAN"
                    })
                    GLOBAL_METRICS["fallbackCandidatesValidated"] += 1
                    GLOBAL_METRICS["candidatesGenerated"] += 1
            else:
                GLOBAL_METRICS["fallbackCandidatesRejected"] += 1

    return candidates

def extract_candidates_from_html(html: str, source_url: str, seen_business: set) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    
    business_contacts = []
    social_profiles = []
    contact_pages = []
    
    # 1. Broad Social Profile Scanner (Anywhere in DOM)
    for a in soup.find_all('a', href=True):
        href = a['href']
        lower_href = href.lower()
        
        # Social Profiles
        if 'linkedin.com/company/' in lower_href or 'linkedin.com/school/' in lower_href:
            if href not in seen_business:
                seen_business.add(href)
                social_profiles.append({"platform": "LinkedIn", "url": href})
        elif 'facebook.com/' in lower_href and 'sharer' not in lower_href:
            if href not in seen_business:
                seen_business.add(href)
                social_profiles.append({"platform": "Facebook", "url": href})
        elif 'instagram.com/' in lower_href:
            if href not in seen_business:
                seen_business.add(href)
                social_profiles.append({"platform": "Instagram", "url": href})
        elif 'twitter.com/' in lower_href or 'x.com/' in lower_href:
            if 'intent/tweet' not in lower_href and 'share' not in lower_href:
                if href not in seen_business:
                    seen_business.add(href)
                    social_profiles.append({"platform": "Twitter", "url": href})
        elif 'youtube.com/' in lower_href or 'youtu.be/' in lower_href:
            if href not in seen_business:
                seen_business.add(href)
                social_profiles.append({"platform": "YouTube", "url": href})

    # 2. Footer Intelligence Pass
    footer_elements = soup.find_all(['footer'])
    for selector in ['.footer', '#footer', '.site-footer', '.main-footer', '.page-footer']:
        footer_elements.extend(soup.select(selector))
        
    if footer_elements:
        GLOBAL_METRICS["footerDetected"] = True
        for footer in footer_elements:
            # Anchor tags in footer
            for a in footer.find_all('a', href=True):
                href = a['href']
                lower_href = href.lower()
                
                if href.startswith('mailto:'):
                    email = urllib.parse.unquote(href.replace('mailto:', '')).split('?')[0].strip()
                    if email and email not in seen_business:
                        seen_business.add(email)
                        business_contacts.append({"type": "EMAIL", "value": email})
                        GLOBAL_METRICS["footerEmailsFound"] += 1
                elif href.startswith('tel:'):
                    phone = urllib.parse.unquote(href.replace('tel:', '')).strip()
                    if phone and phone not in seen_business:
                        seen_business.add(phone)
                        business_contacts.append({"type": "PHONE", "value": phone})
                        GLOBAL_METRICS["footerPhonesFound"] += 1
                elif 'wa.me/' in lower_href or 'api.whatsapp.com' in lower_href:
                    if href not in seen_business:
                        seen_business.add(href)
                        business_contacts.append({"type": "WHATSAPP", "value": href})
                elif any(kw in lower_href for kw in ['/contact', '/contact-us', '/get-in-touch', '/reach-us']):
                    c_url = href.split('#')[0]
                    if c_url not in seen_business:
                        seen_business.add(c_url)
                        contact_pages.append(c_url)
                        
            # Detect physical addresses
            # Look for address tags or text matching address patterns
            address_tags = footer.find_all('address')
            for addr in address_tags:
                addr_text = addr.get_text(separator=' ', strip=True)
                if len(addr_text) > 10 and addr_text not in seen_business:
                    seen_business.add(addr_text)
                    business_contacts.append({"type": "ADDRESS", "value": addr_text})
                    GLOBAL_METRICS["footerAddressesFound"] += 1

    GLOBAL_METRICS["socialProfilesFound"] = len(social_profiles)
    GLOBAL_METRICS["contactPagesFound"] = len(contact_pages)

    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        tag.decompose()
        
    candidates = []
    seen = set()
    
    page_linkedin_urls = set()
    page_emails = set()
    page_phones = set()
    
    for a in soup.find_all('a', href=True):
        href = a['href']
        if "linkedin.com/in/" in href:
            page_linkedin_urls.add(href)
        elif href.startswith('mailto:'):
            page_emails.add(href.replace('mailto:', '').split('?')[0].strip())
        elif href.startswith('tel:'):
            page_phones.add(href.replace('tel:', '').strip())
    
    text_nodes = soup.find_all(string=True)
    GLOBAL_METRICS["rawTextNodesScanned"] += len(text_nodes)
    
    blocks = soup.find_all(['div', 'li', 'section', 'article'])
    page_profile_containers = 0
    
    for block in blocks:
        classes = block.get('class', [])
        if isinstance(classes, list):
            classes = ' '.join(classes)
        block_id = block.get('id', '')
        
        section_type = map_section_type(classes, block_id)
        
        if section_type not in ['TEAM_SECTION', 'LEADERSHIP_SECTION', 'PROFILE_CARD', 'AUTHOR_CARD', 'TESTIMONIAL_CARD']:
            continue
            
        page_profile_containers += 1
        GLOBAL_METRICS["profileContainersDetected"] += 1
            
        has_nested_profiles = False
        for child in block.find_all(['div', 'li', 'section', 'article']):
            if child == block: continue
            child_type = map_section_type(' '.join(child.get('class', [])) if isinstance(child.get('class', []), list) else child.get('class', []), child.get('id', ''))
            if child_type in ['TEAM_SECTION', 'LEADERSHIP_SECTION', 'PROFILE_CARD', 'AUTHOR_CARD', 'TESTIMONIAL_CARD']:
                has_nested_profiles = True
                break
                
        if has_nested_profiles:
            continue
            
        has_image = bool(block.find('img'))
        
        linkedin_links = [a['href'] for a in block.find_all('a', href=True) if "linkedin.com/in/" in a['href']]
        block_has_linkedin = len(linkedin_links) == 1
        block_linkedin_url = linkedin_links[0] if block_has_linkedin else None
        if len(linkedin_links) > 1:
            GLOBAL_METRICS["linkedinOwnershipFailures"] += 1
        
        block_has_email = False
        block_email = None
        block_has_phone = False
        block_phone = None
        
        for a in block.find_all('a', href=True):
            href = a['href']
            if href.startswith('mailto:'):
                block_has_email = True
                block_email = href.replace('mailto:', '').split('?')[0].strip()
            elif href.startswith('tel:'):
                block_has_phone = True
                block_phone = href.replace('tel:', '').strip()
                
        name_cand = None
        title_cand = None
        
        section_labels = [
            "about author", "author", "about the author", "meet the team", 
            "leadership", "management", "team member", "profile", "bio", 
            "about me", "our team", "our leadership", "executive team"
        ]
        
        all_texts = []
        for t in block.find_all(['h2', 'h3', 'h4', 'h5', 'strong', 'b', 'p', 'span', 'div']):
            t_text = t.get_text(strip=True)
            if t_text and t_text not in all_texts:
                all_texts.append(t_text)
                
        for text in all_texts:
            if text.lower() in section_labels:
                GLOBAL_METRICS.setdefault("sectionLabelsRejected", 0)
                GLOBAL_METRICS["sectionLabelsRejected"] += 1
                continue
                
            if not name_cand and looks_like_human_name(text):
                name_cand = text
            elif name_cand and not title_cand and len(text) < 100 and text != name_cand:
                title_cand = text
                
        if not name_cand:
            for text in all_texts:
                if text.lower() in section_labels:
                    continue
                if len(text) < 40 and len(text.split()) <= 4:
                    name_cand = text
                    break
                    
        if name_cand:
            key = name_cand.lower()
            if key not in seen:
                seen.add(key)
                
                score, reject_reason = calculate_pre_gen_score(
                    name_cand, 
                    title_cand, 
                    section_type, 
                    has_image, 
                    block_has_linkedin, 
                    block_has_email, 
                    block_has_phone
                )
                
                if score >= 50:
                    candidates.append({
                        "name": name_cand,
                        "title": title_cand or "",
                        "sectionType": section_type,
                        "hasImage": has_image,
                        "hasLinkedin": block_has_linkedin,
                        "hasEmail": block_has_email,
                        "hasPhone": block_has_phone,
                        "sourceUrl": source_url,
                        "linkedin": block_linkedin_url,
                        "email": block_email,
                        "phone": block_phone,
                        "extractionMethod": "PROFILE_CONTAINER"
                    })
                    GLOBAL_METRICS["candidatesGenerated"] += 1
                else:
                    GLOBAL_METRICS["candidatesRejectedPreGeneration"] += 1
                    if reject_reason == "PHONE":
                        GLOBAL_METRICS["candidatesRejectedAsPhone"] += 1
                    elif reject_reason == "CTA":
                        GLOBAL_METRICS["candidatesRejectedAsCTA"] += 1
                    elif reject_reason == "MARKETING":
                        GLOBAL_METRICS["candidatesRejectedAsMarketing"] += 1
                    elif reject_reason == "PLACEHOLDER":
                        GLOBAL_METRICS["candidatesRejectedAsPlaceholder"] += 1

    # Run Fallback if no primary profiles are found
    if page_profile_containers == 0:
        fallback_candidates = fallback_scanner(soup, source_url, seen)
        candidates.extend(fallback_candidates)
                            
    for href in page_linkedin_urls:
        if href not in seen:
            seen.add(href)
            inferred_name = href.split("linkedin.com/in/")[-1].split('/')[0].replace('-', ' ').title()
            
            score, reject_reason = calculate_pre_gen_score(inferred_name, "", "LINKEDIN_PROFILE", False, True, False, False)
            if score >= 50:
                candidates.append({
                    "name": inferred_name,
                    "title": "",
                    "sectionType": "LINKEDIN_PROFILE",
                    "hasImage": False,
                    "hasLinkedin": True,
                    "hasEmail": False,
                    "hasPhone": False,
                    "sourceUrl": source_url,
                    "linkedin": href,
                    "extractionMethod": "PROFILE_CONTAINER"
                })
                GLOBAL_METRICS["candidatesGenerated"] += 1
                
    return {
        "contacts": candidates,
        "businessContacts": business_contacts,
        "socialProfiles": social_profiles,
        "contactPages": contact_pages
    }

def crawl_and_extract(start_url: str, time_budget: float = 15.0) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    global DOMAIN_TOKEN
    DOMAIN_TOKEN = get_domain_token(start_url)
    start_time = time.time()
    base_domain = get_domain(start_url)
    
    visited = set()
    queue = [(start_url, 0)] # url, depth
    
    all_candidates = []
    all_business_contacts = []
    all_social_profiles = []
    all_contact_pages = []
    global_seen_business = set()
    pages_visited = 0
    MAX_PAGES = 10
    
    while queue and (time.time() - start_time) < time_budget and pages_visited < MAX_PAGES:
        queue.sort(key=lambda x: score_link(x[0]), reverse=True)
        current_url, depth = queue.pop(0)
        
        if current_url in visited:
            continue
            
        visited.add(current_url)
        
        try:
            resp = requests.get(current_url, headers=HEADERS, timeout=15, verify=False)
            if not resp.ok:
                continue
                
            pages_visited += 1
                
            html = resp.text
            extracted = extract_candidates_from_html(html, current_url, global_seen_business)
            all_candidates.extend(extracted.get("contacts", []))
            all_business_contacts.extend(extracted.get("businessContacts", []))
            all_social_profiles.extend(extracted.get("socialProfiles", []))
            all_contact_pages.extend(extracted.get("contactPages", []))
            
            if depth < 2:
                soup = BeautifulSoup(html, "html.parser")
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    full_url = urllib.parse.urljoin(current_url, href)
                    full_url = full_url.split('#')[0]
                    if full_url not in visited and is_valid_link(full_url, base_domain):
                        if score_link(full_url) > 0:
                            queue.append((full_url, depth + 1))
                            
        except Exception as e:
            logger.debug(f"Error crawling {current_url}: {e}")
            if depth == 0:
                raise e
            
    if pages_visited == 0:
        raise Exception("NetworkError")
            
    fallback_metrics = {
        "summaryLength": 0,
        "metaLength": 0,
        "heroLength": 0,
        "aboutLength": 0,
        "servicesLength": 0
    }
    
    GLOBAL_METRICS["pagesVisited"] = pages_visited
    GLOBAL_METRICS["fetchSucceeded"] = True
    
    return {
        "contacts": all_candidates,
        "businessContacts": all_business_contacts,
        "socialProfiles": all_social_profiles,
        "contactPages": list(set(all_contact_pages)),
        "fallback_metrics": fallback_metrics
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("company_name", type=str)
    parser.add_argument("website_url", type=str)
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()

    website_url = args.website_url
    if not website_url.startswith('http://') and not website_url.startswith('https://'):
        website_url = 'https://' + website_url

    start_t = time.time()
    try:
        budget = 15.0 if args.quick else 60.0
        extraction_result = crawl_and_extract(website_url, time_budget=budget)
        candidates = extraction_result["contacts"]
        fallback_metrics = extraction_result["fallback_metrics"]
        
        metrics = {
            "candidate_count": len(candidates),
            "time_taken": round(time.time() - start_t, 2),
            **fallback_metrics,
            **GLOBAL_METRICS
        }
        
        output = {
            "success": True,
            "contacts": candidates,
            "businessContacts": extraction_result["businessContacts"],
            "socialProfiles": extraction_result["socialProfiles"],
            "contactPages": extraction_result["contactPages"],
            "metrics": metrics
        }
        print(json.dumps(output))

    except requests.exceptions.MissingSchema:
        logger.error("Scraping failed: MissingSchema")
        output = {
            "success": False,
            "error": "MissingSchema",
            "contacts": [],
            "metrics": {"fetchSucceeded": False, "pagesVisited": 0}
        }
        print(json.dumps(output))
        sys.exit(1)
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
        logger.error(f"Network error while connecting to {website_url}: {e}")
        output = {
            "success": False,
            "error": "NetworkError",
            "contacts": [],
            "metrics": {"fetchSucceeded": False, "pagesVisited": 0}
        }
        print(json.dumps(output))
        sys.exit(1)
    except Exception as e:
        logger.exception("Scraping failed")
        output = {
            "success": False,
            "error": str(e),
            "contacts": [],
            "metrics": {"fetchSucceeded": False, "pagesVisited": 0}
        }
        print(json.dumps(output))
        sys.exit(1)

if __name__ == "__main__":
    main()
