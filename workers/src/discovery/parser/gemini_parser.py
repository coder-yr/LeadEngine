import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class GeminiParser:
    """
    Validates and normalizes JSON output from Gemini Search Grounding.
    Rejects hallucinations, directory sites, and malformed records.
    """
    
    REQUIRED_FIELDS = ["companyName", "website", "confidence"]
    
    BLACKLIST_DOMAINS = [
        "justdial.com", "sulekha.com", "indiamart.com", "tradeindia.com",
        "wikipedia.org", "facebook.com", "instagram.com", "linkedin.com",
        "twitter.com", "youtube.com", "quora.com", "reddit.com",
        "glassdoor.com", "naukri.com", "indeed.com", "zoominfo.com",
        "yellowpages.in", "grotal.com", "asklaila.com", "hotfrog.com",
        "practo.com", "lybrate.com", "yelp.com", "zauba.com"
    ]

    @classmethod
    def parse_discovery_results(cls, raw_json: Any) -> List[Dict[str, Any]]:
        """Parses the raw JSON list and returns valid, normalized records."""
        if not isinstance(raw_json, list):
            logger.warning("[GeminiParser] Root element is not a list. Rejecting.")
            return []
            
        valid_records = []
        
        for item in raw_json:
            if not isinstance(item, dict):
                continue
                
            def safe_str(val: Any) -> str:
                return str(val).strip() if val is not None else ""
                
            # 1. Check required fields
            if not all(field in item for field in cls.REQUIRED_FIELDS):
                logger.debug(f"[GeminiParser] Rejecting record missing required fields: {item.get('companyName', 'Unknown')}")
                continue
                
            # 2. Normalize and validate Website
            website = safe_str(item.get("website"))
            if not website or not website.startswith("http"):
                logger.debug(f"[GeminiParser] Rejecting record with invalid website: {website}")
                continue
                
            is_blacklisted = any(d in website.lower() for d in cls.BLACKLIST_DOMAINS)
            if is_blacklisted:
                logger.debug(f"[GeminiParser] Rejecting directory/blacklisted website: {website}")
                continue
                
            # 3. Confidence Check
            confidence = item.get("confidence", 0)
            try:
                confidence = int(confidence) if confidence is not None else 0
            except ValueError:
                confidence = 0
                
            if confidence < 80:
                logger.debug(f"[GeminiParser] Rejecting record due to low confidence ({confidence}): {website}")
                continue
                
            # 4. Normalization
            normalized = {
                "business_name": safe_str(item.get("companyName")),
                "website": website,
                "phone": cls._normalize_phone(item.get("phone")),
                "email": safe_str(item.get("email")),
                "address": safe_str(item.get("address")),
                "city": safe_str(item.get("city")),
                "state": safe_str(item.get("state")),
                "confidence": confidence,
                "category": safe_str(item.get("category")),
                "why_selected": safe_str(item.get("whySelected")),
                # Extract verification flags if provided
                "verification": item.get("verification") or {}
            }
            
            valid_records.append(normalized)
            
        return valid_records

    @classmethod
    def _normalize_phone(cls, phone: str) -> str:
        if not phone:
            return ""
        # Basic stripping of non-phone characters (keep +, spaces, dashes for now)
        cleaned = ''.join(c for c in str(phone) if c.isdigit() or c in '+-() ')
        return cleaned.strip()
