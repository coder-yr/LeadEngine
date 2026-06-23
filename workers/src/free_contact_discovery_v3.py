import argparse
import json
import logging
import re
import urllib.parse
import time
import sys
from typing import List, Dict, Any

import requests
# pyrefly: ignore [missing-import]
from bs4 import BeautifulSoup
# pyrefly: ignore [missing-import]
import ollama

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

TITLE_KEYWORDS = [
    "founder", "co-founder", "ceo", "owner", "director", "managing director",
    "partner", "principal", "president", "vice president", "general manager",
    "branch manager", "regional manager", "operations manager", "sales manager",
    "marketing manager", "business development manager", "store manager",
    "managing partner", "clinic head", "medical director", "head of operations",
    "head of marketing", "cto", "cio", "coo", "cfo", "hr manager", "manager"
]

INVALID_NAME_KEYWORDS = [
    "platform", "service", "services", "solution", "partner", "health",
    "wellness", "technology", "company", "business", "organization",
    "clinic", "agency"
]

STRICT_NAME_RE = re.compile(r'^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}$')

def normalize_contacts(contacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    seen = set()
    
    for c in contacts:
        raw_name = c.get("full_name", "").strip()
        title = c.get("title", "").strip()
        
        # Keep non-names if they have valid emails/phones (unless user explicitly wants them removed)
        # But if raw_name is literally "Business Contact", we should evaluate if we keep it
        if not raw_name or raw_name == "Business Contact":
            if c.get("email") or c.get("phone") or c.get("linkedin_url"):
                key = f":{c.get('email')}:{c.get('phone')}:{c.get('linkedin_url')}".lower()
                if key not in seen:
                    normalized.append(c)
                    seen.add(key)
            continue
            
        # Rule 3: Split multiple
        parts = re.split(r'\s+&\s+|\s+and\s+|\s+/\s+', raw_name)
        
        for p in parts:
            # Rule 2: Reject embedded titles
            if ',' in p:
                pieces = p.split(',', 1)
                p = pieces[0].strip()
                if not title and len(pieces) > 1:
                    title = pieces[1].strip()
            if '-' in p:
                pieces = p.split('-', 1)
                p = pieces[0].strip()
                if not title and len(pieces) > 1:
                    title = pieces[1].strip()
                    
            p = p.strip()
            lower_p = p.lower()
            
            # Additional sweep for titles without commas (e.g. "Arushi Sethi CEO")
            for t_kw in ["ceo", "founder", "co-founder", "director", "chairperson", "manager", "president", "officer"]:
                if lower_p.endswith(f" {t_kw}"):
                    p = p[:-(len(t_kw)+1)].strip()
                    lower_p = p.lower()
            
            # Rule 1: Reject non-human
            invalid = False
            for kw in INVALID_NAME_KEYWORDS:
                if kw in lower_p:
                    invalid = True
                    break
            if invalid:
                continue
                
            # Rule 4: Strict human name validation
            if STRICT_NAME_RE.match(p):
                # Rule 5: Deduplicate
                key = p.lower()
                if key not in seen:
                    new_c = c.copy()
                    new_c["full_name"] = p
                    new_c["title"] = title
                    new_c["decision_maker_score"] = score_decision_maker(title)
                    normalized.append(new_c)
                    seen.add(key)

    return normalized

def score_decision_maker(title: str) -> int:
    if not title:
        return 20
    lower = title.lower().strip()
    
    # Matching exact or substring rules mapped to the user request
    scores = {
        'founder': 100, 'co-founder': 95, 'ceo': 95, 'owner': 95, 
        'chief executive': 95, 'managing director': 90, 'director': 90,
        'partner': 85, 'managing partner': 85, 'president': 90, 'vice president': 75,
        'vp': 75, 'cto': 90, 'cio': 90, 'coo': 90, 'cfo': 90, 'medical director': 90,
        'general manager': 60, 'gm': 60, 'branch manager': 60, 'regional manager': 60,
        'operations manager': 50, 'head of operations': 75, 'sales manager': 50,
        'marketing manager': 50, 'head of marketing': 75, 'business development manager': 70,
        'store manager': 50, 'clinic head': 80, 'hr manager': 50,
        'doctor': 80, 'psychiatrist': 80, 'clinical psychologist': 80,
        'psychologist': 80, 'dentist': 80,
        'manager': 40, 'head': 70,
        'consultant': 60, 'principal': 60, 'lead': 50, 'supervisor': 45,
    }
    
    for keyword, score in scores.items():
        if keyword in lower:
            return score
    return 20

def clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "aside", "header", "noscript", "svg", "path", "button", "form"]):
        tag.decompose()
    text = soup.get_text("\n")
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    return "\n".join(lines)

def extract_contacts_regex(html: str, source: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    contacts = []
    seen = set()

    # Regexes
    linkedin_regex = re.compile(r"(https?://(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?)[^\s\"'>]*", re.I)
    
    # We will use text nodes for titles and names
    for tag in soup(["script", "style", "nav", "footer", "aside", "header", "noscript", "svg", "path", "button", "form"]):
        tag.decompose()
        
    # Extract emails from mailto
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('mailto:'):
            email = href.replace('mailto:', '').split('?')[0].strip()
            if email and email not in seen:
                contacts.append({"email": email, "full_name": a.text.strip() if a.text else "", "source": source})
                seen.add(email)
                
        if href.startswith('tel:'):
            phone = href.replace('tel:', '').strip()
            if phone and phone not in seen:
                contacts.append({"phone": phone, "full_name": a.text.strip() if a.text else "", "source": source})
                seen.add(phone)

    # Extract LinkedIn URLs from href attributes
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()

        if any(x in href.lower() for x in ["linkedin.com/in/", "linkedin.com/company/", "linkedin.com/pub/"]):
            if href not in seen:
                contacts.append({
                    "linkedin_url": href,
                    "full_name": "",
                    "source": source
                })
                seen.add(href)
            
    # Try finding title keywords and adjacent names
    text = soup.get_text("\n")
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Extract plain text emails and phones
    email_re = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
    # Matches +91 98200 98200 or 999-999-9999
    phone_re = re.compile(r"(?:\+?\d{1,3}[ ]?)?(?:\d[ -]?){9,14}\d")

    for line in lines:
        for email in email_re.findall(line):
            email_lower = email.lower().strip()
            # Ignore common image extensions that look like emails
            if email_lower.endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4')):
                continue
            if email_lower and email_lower not in seen:
                contacts.append({"email": email_lower, "full_name": "Business Contact", "source": source})
                seen.add(email_lower)
        
        for phone in phone_re.findall(line):
            phone_clean = phone.strip()
            digit_count = len(re.sub(r"\D", "", phone_clean))
            if 10 <= digit_count <= 15 and phone_clean not in seen:
                contacts.append({"phone": phone_clean, "full_name": "Business Contact", "source": source})
                seen.add(phone_clean)

    name_regex = re.compile(r"^(Dr\.?\s+[A-Z][a-z]+)|([A-Z][a-z]+\s+[A-Z][a-z]+)")
    
    for i, line in enumerate(lines):
        line_lower = line.lower()
        matched_title = None
        for keyword in TITLE_KEYWORDS:
            if keyword in line_lower:
                if len(line) < 60:
                    matched_title = line
                break
                
        if matched_title:
            name_cand = ""
            title_cand = matched_title
            
            # ISSUE 3: Inline Name & Title Mapping
            # Example: "Anureet Sethi, Co-Founder & Chairperson"
            # If the matched_title line ITSELF starts with a name followed by a comma or dash:
            inline_match = re.match(r'^([A-Z][a-z]+\s[A-Z][a-z]+(?:[\s&/a-zA-Z]*))[,|-]\s*(.+)$', matched_title)
            if inline_match:
                name_cand = inline_match.group(1).strip()
                title_cand = inline_match.group(2).strip()
            else:
                # Fallback to look above or below for a name
                if i > 0 and name_regex.match(lines[i-1]) and len(lines[i-1]) < 40:
                    name_cand = lines[i-1]
                elif i < len(lines)-1 and name_regex.match(lines[i+1]) and len(lines[i+1]) < 40:
                    name_cand = lines[i+1]
                
            if name_cand:
                # Add to contacts if name not seen
                key = name_cand.lower()
                if key not in seen:
                    contacts.append({
                        "full_name": name_cand,
                        "title": title_cand,
                        "source": source
                    })
                    seen.add(key)
                    
    return contacts


def extract_candidate_chunks(text: str) -> str:
    lines = text.split("\n")
    email_regex = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
    linkedin_regex = re.compile(r"linkedin\.com", re.I)
    name_regex = re.compile(r"(Dr\.?\s+[A-Z][a-z]+)|([A-Z][a-z]+\s+[A-Z][a-z]+)")

    selected = set()
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if (email_regex.search(line) or linkedin_regex.search(line) or name_regex.search(line) or any(k in line_lower for k in TITLE_KEYWORDS)):
            start = max(0, i - 25)
            end = min(len(lines), i + 25)
            for j in range(start, end):
                selected.add(j)

    if not selected:
        selected = set(range(min(100, len(lines))))

    return "\n".join(lines[i] for i in sorted(selected))

def extract_json(content: str):
    try:
        return json.loads(content)
    except:
        pass
    start = content.find("[")
    end = content.rfind("]")
    if start == -1 or end == -1:
        return []
    try:
        return json.loads(content[start:end + 1])
    except:
        return []

def call_ollama(text_chunk: str, company_name: str):
    if len(text_chunk.strip()) < 20:
        return []
    prompt = f"""
Extract ONLY real humans working at {company_name}.
Return STRICT JSON.
Format:
[
 {{
   "full_name":"",
   "title":"",
   "email":"",
   "phone":"",
   "linkedin_url":"",
   "whatsapp":""
 }}
]
Rules:
- Do not return company names.
- Do not return agencies.
- Do not return support or general info emails.
- Only return real people.
- Return JSON only.
"""
    try:
        response = ollama.chat(
            model="qwen3:8b",
            messages=[
                {"role": "system", "content": "You are a JSON extraction engine."},
                {"role": "user", "content": prompt + "\n\n" + text_chunk[:10000]}
            ],
            options={"temperature": 0}
        )
        content = response["message"]["content"]
        contacts = extract_json(content)
        if isinstance(contacts, list):
            valid_contacts = []
            for c in contacts:
                email = c.get("email", "").strip()
                phone = c.get("phone", "").strip()
                linkedin = c.get("linkedin_url", "").strip()
                
                # Rule #1: Validate against text_chunk
                if email and email.lower() not in text_chunk.lower():
                    c["email"] = ""
                if phone and phone not in text_chunk:
                    c["phone"] = ""
                if linkedin and linkedin.lower() not in text_chunk.lower():
                    c["linkedin_url"] = ""
                    
                valid_contacts.append(c)
            return valid_contacts
    except Exception as e:
        logger.error(f"Ollama Error: {e}")
    return []

def determine_source(url: str):
    url = url.lower()
    if any(x in url for x in ["/team", "/our-team", "/staff", "/people"]):
        return "website_team_page"
    if any(x in url for x in ["/leadership", "/management", "/founders", "/executive"]):
        return "website_leadership_page"
    if "/about" in url or "/company" in url:
        return "website_about_page"
    if "/contact" in url or "/locations" in url or "/branches" in url:
        return "website_contact_page"
    return "website_homepage"

def calculate_confidence(c: dict) -> int:
    name = c.get("full_name", "").strip()
    title = c.get("title", "").strip()
    email = c.get("email", "").strip()
    phone = c.get("phone", "").strip()
    linkedin = c.get("linkedin_url", "").strip()
    
    is_business = (name == "Business Contact")
    
    if not is_business and name and title and (email or phone):
        return 95
    if not is_business and name and title:
        return 80
    if is_business and (email or phone):
        return 60
    if not name and not email and not phone and linkedin:
        return 50
    return 50

def main():
    start = time.time()
    parser = argparse.ArgumentParser()
    parser.add_argument("--company", required=True)
    parser.add_argument("--website", required=True)
    parser.add_argument("--quick", action="store_true", help="Skip Ollama LLM execution")
    args = parser.parse_args()

    website = args.website
    if not website.startswith("http"):
        website = f"https://{website}"

    targets = [
        website,
        urllib.parse.urljoin(website, "/contact"),
        urllib.parse.urljoin(website, "/contact-us"),
        urllib.parse.urljoin(website, "/about"),
        urllib.parse.urljoin(website, "/team"),
        urllib.parse.urljoin(website, "/leadership"),
        urllib.parse.urljoin(website, "/management"),
        urllib.parse.urljoin(website, "/people"),
        urllib.parse.urljoin(website, "/locations")
    ]

    urls = []
    seen_urls = set()
    for u in targets:
        if u not in seen_urls:
            seen_urls.add(u)
            urls.append(u)

    urls = urls[:5] # Max 5 pages

    metrics = {
        "pages_crawled": 0,
        "characters_processed": 0,
        "ai_calls": 0,
        "emails_found": 0,
        "phones_found": 0,
        "linkedin_found": 0
    }

    contacts = []
    seen_contacts = set()

    for url in urls:
        if time.time() - start > 20: # 20s max runtime per company
            break
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code != 200:
                continue

            metrics["pages_crawled"] += 1
            source = determine_source(url)
            
            # Use Regex Extraction first
            regex_contacts = extract_contacts_regex(r.text, source)
            
            for c in regex_contacts:
                full_name = c.get("full_name", "").strip()
                email = c.get("email", "").strip()
                if not full_name and not email and not c.get("linkedin_url") and not c.get("phone"):
                    continue
                
                key = (full_name.lower(), email.lower(), c.get("phone", "").lower(), c.get("linkedin_url", "").lower())
                if key in seen_contacts:
                    continue
                seen_contacts.add(key)
                
                c["confidence_score"] = calculate_confidence(c)
                c["decision_maker_score"] = score_decision_maker(c.get("title", ""))
                contacts.append(c)

            text = clean_html(r.text)[:10000] # Max 10,000 characters
            metrics["characters_processed"] += len(text)
            
        except Exception as e:
            logger.error(f"{url}: {e}")

    # Ollama Fallback Logic (Rule #2)
    has_names_or_titles = any(c.get("full_name") or c.get("title") for c in contacts)
    if not args.quick and not has_names_or_titles:
        for url in urls:
            if time.time() - start > 20:
                break
            try:
                r = requests.get(url, headers=HEADERS, timeout=10)
                if r.status_code != 200: continue
                text = clean_html(r.text)[:10000]
                chunk = extract_candidate_chunks(text)
                
                if not chunk.strip(): continue
                
                metrics["ai_calls"] += 1
                extracted = call_ollama(chunk, args.company)
                source = determine_source(url)

                for c in extracted:
                    full_name = c.get("full_name", "").strip()
                    if not full_name:
                        if c.get("email") or c.get("phone"):
                            c["full_name"] = "Business Contact"
                            full_name = "Business Contact"
                        else:
                            continue
                    key = (full_name.lower(), c.get("email", "").lower(), c.get("phone", "").lower(), c.get("linkedin_url", "").lower())
                    if key in seen_contacts:
                        continue
                    seen_contacts.add(key)

                    c["source"] = source
                    c["confidence_score"] = calculate_confidence(c)
                    c["decision_maker_score"] = score_decision_maker(c.get("title", ""))
                    contacts.append(c)
            except Exception as e:
                logger.error(f"{url} fallback: {e}")

    # Apply all 5 Strict Validation Rules
    contacts = normalize_contacts(contacts)

    # Metrics computation
    decision_makers = 0
    for c in contacts:
        if c.get("email"): metrics["emails_found"] += 1
        if c.get("phone"): metrics["phones_found"] += 1
        if c.get("linkedin_url"): metrics["linkedin_found"] += 1
        if c.get("decision_maker_score", 0) >= 80: decision_makers += 1

    processing_time = round(time.time() - start, 2)

    # Reporting to STDERR
    report = f"""
--- CONTACT DISCOVERY REPORT ---
Company: {args.company}
Pages Crawled: {metrics["pages_crawled"]}
Contacts Found: {len(contacts)}
Decision Makers: {decision_makers}
Emails: {metrics["emails_found"]}
Phones: {metrics["phones_found"]}
LinkedIn URLs: {metrics["linkedin_found"]}
Ollama Calls: {metrics["ai_calls"]}
Processing Time: {processing_time}s
--------------------------------
"""
    print(report, file=sys.stderr)

    output = {
        "contacts": contacts,
        "metrics": metrics,
        "processing_time": processing_time
    }
    print(json.dumps(output))

if __name__ == "__main__":
    main()
