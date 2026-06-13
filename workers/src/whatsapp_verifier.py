import os
import re
import logging
import requests
from enum import Enum

logger = logging.getLogger(__name__)

class WhatsAppStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    UNKNOWN = "UNKNOWN"

def normalize_e164(phone: str) -> str:
    """
    Normalizes a given phone number string to E.164 format.
    Strips all non-digit characters and ensures a '+' prefix.
    """
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    if not cleaned.startswith('+'):
        # If no plus, assume digits include the country code
        cleaned = '+' + cleaned
        
    # E.164 numbers generally contain up to 15 digits
    digits = re.sub(r'\D', '', cleaned)
    if not (7 <= len(digits) <= 15):
        raise ValueError(f"Invalid phone number length for E.164: {phone}")
        
    return f"+{digits}"

def verify_whatsapp(phone_number: str) -> WhatsAppStatus:
    """
    Verifies if a phone number is active on WhatsApp.
    Uses wa.me as a primary check and falls back to an external provider.
    """
    try:
        e164_number = normalize_e164(phone_number)
    except ValueError as e:
        logger.warning(f"Normalization failed: {e}")
        return WhatsAppStatus.INACTIVE

    digits_only = e164_number[1:]
    
    # 1. Primary Check: wa.me
    try:
        wa_url = f"https://wa.me/{digits_only}"
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.head(wa_url, headers=headers, allow_redirects=True, timeout=5)
        
        # wa.me typically returns 200 for any properly formatted number, 
        # but 404 or other errors indicate invalid routing.
        if response.status_code != 200:
            return WhatsAppStatus.INACTIVE
            
    except requests.RequestException as e:
        logger.warning(f"wa.me check failed for {e164_number}: {e}")
        # Continue to fallback on network error

    # 2. Fallback Provider
    fallback_api_key = os.getenv("FALLBACK_VERIFY_API_KEY")
    if fallback_api_key:
        try:
            # Example using Abstract API for phone validation
            api_url = f"https://phonevalidation.abstractapi.com/v1/?api_key={fallback_api_key}&phone={e164_number}"
            r = requests.get(api_url, timeout=5)
            
            if r.status_code == 200:
                data = r.json()
                is_valid = data.get("valid")
                
                if is_valid is True:
                    return WhatsAppStatus.ACTIVE
                elif is_valid is False:
                    return WhatsAppStatus.INACTIVE
                    
        except requests.RequestException as e:
            logger.error(f"Fallback verification API failed: {e}")

    # If wa.me succeeds but we can't definitively confirm the number is an active WhatsApp account
    # (since wa.me doesn't expose account existence publicly without scraping specific React props),
    # we return UNKNOWN to be safe, unless we implement deeper scraping or an official API.
    return WhatsAppStatus.UNKNOWN
