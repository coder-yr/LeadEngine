from typing import Dict, Any, Optional
import re
from urllib.parse import urlparse

# Source reliability scores
SOURCE_SCORES = {
    "google_maps": 20,
    "website_search": 15,
    "duckduckgo": 10,
    "grotal": 5,
    "asklaila": 5,
    "yellowpages": 5,
    "hotfrog": 5
}

# Domains to filter out (social media, directories, etc.)
EXCLUDED_DOMAINS = {
    "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "twitter.com", "x.com",
    "justdial.com", "sulekha.com", "indiamart.com", "tradeindia.com", "wikipedia.org",
    "glassdoor.com", "glassdoor.co.in", "naukri.com", "indeed.com", "foundit.in", "monster.com",
    "zoominfo.com", "crunchbase.com", "zaubacorp.com", "tofler.in", "ambitionbox.com",
    "practo.com", "lybrate.com", "magicbricks.com", "99acres.com", "housing.com",
    "jd.com", "justdial.in", "indiamart.in", "yellowpages.in", "yellowpages.com",
    "grotal.com", "asklaila.com", "hotfrog.in", "hotfrog.com"
}

def is_valid_company_domain(url: str) -> bool:
    """Check if the URL belongs to a valid company domain (not a directory or social media)."""
    if not url:
        return False
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        
        # Filter out government sites
        if domain.endswith(".gov") or domain.endswith(".gov.in") or domain.endswith(".nic.in"):
            return False
            
        # Filter out known directories
        for excluded in EXCLUDED_DOMAINS:
            if domain == excluded or domain.endswith(f".{excluded}"):
                return False
                
        return True
    except Exception:
        return False

def calculate_quality_score(business: Dict[str, Any]) -> int:
    """Calculate the quality score based on available data and source reliability."""
    score = 0
    
    # Data points scores
    if business.get("Website"):
        score += 40
    if business.get("Email"):
        score += 30
    if business.get("Phone"):
        score += 25
    if business.get("Address"):
        score += 15
    if business.get("Category"):
        score += 10
        
    # Source reliability score
    source = business.get("Source", "").lower()
    score += SOURCE_SCORES.get(source, 0)
    
    return score

def create_standard_record(
    name: str,
    source: str,
    website: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    category: Optional[str] = None,
    email: Optional[str] = None
) -> Dict[str, Any]:
    """Create a standardized business record with calculated quality score."""
    record = {
        "Business Name": name.strip() if name else "",
        "Website": website.strip() if website else "",
        "Phone": phone.strip() if phone else "",
        "Address": address.strip() if address else "",
        "Category": category.strip() if category else "",
        "Email": email.strip() if email else "",
        "Source": source.lower().strip()
    }
    
    # Clean up phone number (remove +91 prefix if standard, strip spaces)
    if record["Phone"]:
        clean_phone = re.sub(r'[^\d+]', '', record["Phone"])
        if clean_phone.startswith("0"):
            clean_phone = "+91" + clean_phone[1:]
        elif len(clean_phone) == 10 and not clean_phone.startswith("+"):
            clean_phone = "+91" + clean_phone
        record["Phone"] = clean_phone
        
    record["quality_score"] = calculate_quality_score(record)
    return record
