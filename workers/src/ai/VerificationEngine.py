import logging
from urllib.parse import urlparse
from typing import List
import re

from discovery.base_source import DiscoveryRecord

logger = logging.getLogger(__name__)

class VerificationEngine:
    """
    Validates records returned by AI Search Providers before they enter the pipeline.
    Ensures that AI hallucinations are caught and rejected.
    """
    
    @classmethod
    def verify_records(cls, records: List[DiscoveryRecord]) -> List[DiscoveryRecord]:
        """Runs verification checks on a batch of records."""
        verified = []
        for rec in records:
            if cls._verify_record(rec):
                verified.append(rec)
            else:
                logger.debug(f"[VerificationEngine] Rejected hallucinated/invalid record: {rec.business_name}")
        return verified
        
    @classmethod
    def _verify_record(cls, record: DiscoveryRecord) -> bool:
        """
        Validates individual fields.
        Returns True if the record meets the minimum quality standard.
        """
        # Must have a name
        if not record.business_name or record.business_name.lower() == "unknown":
            return False
            
        # Verify Website (If provided, must be syntactically valid)
        if record.website:
            if not record.website.startswith("http"):
                return False
            domain = urlparse(record.website).netloc
            if "." not in domain:
                return False
                
            # Block common directories that AI tends to scrape
            blacklist = ["justdial", "sulekha", "practo", "indiamart", "facebook", "instagram"]
            if any(b in domain.lower() for b in blacklist):
                return False
                
        # Verify Phone (If provided, shouldn't be obvious fake)
        if record.phone:
            digits = re.sub(r'\D', '', record.phone)
            if len(digits) > 0 and len(digits) < 7: # Too short to be real
                return False
            if digits in ["1234567890", "0000000000", "9999999999"]:
                return False
                
        # Must have at least one contact vector (website or phone)
        if not record.website and not record.phone:
            return False
            
        return True
