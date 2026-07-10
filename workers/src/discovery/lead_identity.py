"""
lead_identity.py — Identity Resolution Layer.

Resolves multiple DiscoveryRecord entries from different sources
into a single LeadIdentity using 6-signal matching:

  1. Exact phone (E.164 last 10 digits)
  2. Exact domain
  3. Exact GSTIN
  4. Exact CIN
  5. Normalized name fuzzy match (Levenshtein >= 0.85)
  6. Address hash match

Business name normalization strips common suffixes so:
  "ABC Dental" == "ABC Dental Clinic" == "ABC Dental Care" == "ABC Dental Pvt Ltd"
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from discovery.base_source import DiscoveryRecord

logger = logging.getLogger(__name__)

# Levenshtein threshold for name matching
NAME_SIMILARITY_THRESHOLD = 0.85

# Common business name suffixes to strip during normalization
STRIP_SUFFIXES = [
    r"\s+pvt\.?\s*ltd\.?",
    r"\s+private\s+limited",
    r"\s+limited",
    r"\s+ltd\.?",
    r"\s+llp",
    r"\s+llc",
    r"\s+inc\.?",
    r"\s+corp\.?",
    r"\s+co\.?",
    r"\s+&\s+co\.?",
    r"\s+associates",
    r"\s+associate",
    r"\s+enterprises",
    r"\s+enterprise",
    r"\s+solutions",
    r"\s+services",
    r"\s+technologies",
    r"\s+technology",
    r"\s+tech",
    r"\s+group",
    r"\s+india",
    r"\s+international",
    r"\s+clinic",
    r"\s+clinics",
    r"\s+hospital",
    r"\s+hospitals",
    r"\s+care",
    r"\s+centre",
    r"\s+center",
    r"\s+academy",
    r"\s+institute",
    r"\s+studio",
    r"\s+studios",
    r"\s+agency",
    r"\s+consultancy",
    r"\s+consultant",
    r"\s+consultants",
]

_SUFFIX_PATTERN = re.compile(
    "(" + "|".join(STRIP_SUFFIXES) + r")+\s*$",
    re.IGNORECASE,
)


def _normalize_name(name: str) -> str:
    """
    Normalize a business name for comparison.
    Strips suffixes, lowercase, removes punctuation.
    """
    if not name:
        return ""
    s = name.lower().strip()
    s = _SUFFIX_PATTERN.sub("", s).strip()
    s = re.sub(r"[^\w\s]", "", s)  # Remove punctuation
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _normalize_phone(phone: Optional[str]) -> Optional[str]:
    """Return last 10 digits of phone, or None."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else None


def _normalize_domain(url: Optional[str]) -> Optional[str]:
    """Extract hostname without www., or None."""
    if not url:
        return None
    try:
        u = url if url.startswith("http") else "https://" + url
        from urllib.parse import urlparse
        host = urlparse(u).netloc.lower().lstrip("www.")
        return host or None
    except Exception:
        return None


def _address_hash(address: Optional[str]) -> Optional[str]:
    """MD5 of normalized address for equality check."""
    if not address:
        return None
    normalized = re.sub(r"\s+", " ", address.lower().strip())
    normalized = re.sub(r"[^\w\s,]", "", normalized)
    return hashlib.md5(normalized.encode()).hexdigest()


def _levenshtein_ratio(a: str, b: str) -> float:
    """Simple Levenshtein similarity ratio."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # Dynamic programming Levenshtein
    m, n = len(a), len(b)
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        curr = [i] + [0] * n
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    dist = prev[n]
    return 1.0 - dist / max(m, n)


@dataclass
class LeadIdentity:
    """
    A resolved identity representing one real-world business,
    potentially discovered from multiple sources.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    normalized_name: str = ""
    normalized_domain: Optional[str] = None
    normalized_phone: Optional[str] = None
    address_hash: Optional[str] = None
    gstin: Optional[str] = None
    cin: Optional[str] = None
    source_ids: List[str] = field(default_factory=list)
    source_names: List[str] = field(default_factory=list)
    source_count: int = 0
    stage: str = "DISCOVERED"
    identity_confidence: float = 0.0
    raw_records: List[DiscoveryRecord] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def best_record(self) -> Optional[DiscoveryRecord]:
        """Return the highest quality_score record in this identity."""
        if not self.raw_records:
            return None
        return max(self.raw_records, key=lambda r: r.quality_score)

    def best_website_record(self) -> Optional[DiscoveryRecord]:
        """Return the record with the highest scoring website based on V3 candidate scoring."""
        if not self.raw_records:
            return None
            
        gmaps_record = next((r for r in self.raw_records if r.source == "google_maps"), None)
        base_phone = _normalize_phone(gmaps_record.phone) if gmaps_record else None
        base_addr = _address_hash(gmaps_record.address) if gmaps_record else None

        best_score = -1
        best_rec = None
        for r in self.raw_records:
            if not r.website:
                continue
                
            score = 0
            if r.source == "google_maps":
                score += 20
            elif r.source == "duckduckgo":
                score += 15
            elif r.source == "website_search":
                score += 10
                
            if r.website.startswith("https://"):
                score += 10
                
            if base_phone and _normalize_phone(r.phone) == base_phone:
                score += 25
                
            if base_addr and _address_hash(r.address) == base_addr:
                score += 20
                
            if score > best_score:
                best_score = score
                best_rec = r
                
        return best_rec

    def to_dict(self) -> Dict[str, Any]:
        best = self.best_record()
        best_web = self.best_website_record()
        
        return {
            "id": self.id,
            "normalized_name": self.normalized_name,
            "normalized_domain": self.normalized_domain,
            "normalized_phone": self.normalized_phone,
            "address_hash": self.address_hash,
            "gstin": self.gstin,
            "cin": self.cin,
            "source_count": self.source_count,
            "source_names": self.source_names,
            "stage": self.stage,
            "identity_confidence": round(self.identity_confidence, 2),
            "best_name": best.business_name if best else self.normalized_name,
            "best_phone": best.phone if best else None,
            "best_website": best_web.website if best_web else None,
            "best_address": best.address if best else None,
            "best_email": best.email if best else None,
            "best_quality_score": best.quality_score if best else 0,
        }


class IdentityResolver:
    """
    Resolves a list of DiscoveryRecord entries into LeadIdentity objects
    using 6-signal matching.
    """

    def resolve(self, records: List[DiscoveryRecord]) -> List[LeadIdentity]:
        """
        Group records into identities.
        Returns one LeadIdentity per unique real-world business.
        """
        if not records:
            return []

        # Pre-compute normalized signals for each record
        phones: Dict[int, Optional[str]] = {}
        domains: Dict[int, Optional[str]] = {}
        names: Dict[int, str] = {}
        addr_hashes: Dict[int, Optional[str]] = {}

        for i, r in enumerate(records):
            phones[i] = _normalize_phone(r.phone)
            domains[i] = _normalize_domain(r.website)
            names[i] = _normalize_name(r.business_name)
            addr_hashes[i] = _address_hash(r.address)

        # Union-find to group matching records
        parent = list(range(len(records)))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x: int, y: int) -> None:
            rx, ry = find(x), find(y)
            if rx != ry:
                parent[rx] = ry

        # Signal 1: Phone match
        phone_index: Dict[str, int] = {}
        for i, phone in phones.items():
            if phone:
                if phone in phone_index:
                    union(i, phone_index[phone])
                else:
                    phone_index[phone] = i

        # Signal 2: Domain match
        domain_index: Dict[str, int] = {}
        for i, domain in domains.items():
            if domain:
                if domain in domain_index:
                    union(i, domain_index[domain])
                else:
                    domain_index[domain] = i

        # Signal 3: GSTIN match
        gstin_index: Dict[str, int] = {}
        for i, r in enumerate(records):
            if r.gstin:
                if r.gstin in gstin_index:
                    union(i, gstin_index[r.gstin])
                else:
                    gstin_index[r.gstin] = i

        # Signal 4: CIN match
        cin_index: Dict[str, int] = {}
        for i, r in enumerate(records):
            if r.cin:
                if r.cin in cin_index:
                    union(i, cin_index[r.cin])
                else:
                    cin_index[r.cin] = i

        # Signal 5: Fuzzy name match
        for i in range(len(records)):
            for j in range(i + 1, len(records)):
                if find(i) == find(j):
                    continue  # Already grouped
                if names[i] and names[j]:
                    sim = _levenshtein_ratio(names[i], names[j])
                    if sim >= NAME_SIMILARITY_THRESHOLD:
                        union(i, j)

        # Signal 6: Address hash match
        addr_hash_index: Dict[str, int] = {}
        for i, ah in addr_hashes.items():
            if ah:
                if ah in addr_hash_index:
                    union(i, addr_hash_index[ah])
                else:
                    addr_hash_index[ah] = i

        # Group records by their root parent
        groups: Dict[int, List[int]] = {}
        for i in range(len(records)):
            root = find(i)
            groups.setdefault(root, []).append(i)

        # Build LeadIdentity per group
        identities: List[LeadIdentity] = []
        for root, indices in groups.items():
            group_records = [records[i] for i in indices]

            # Pick best record (highest quality_score)
            best = max(group_records, key=lambda r: r.quality_score)

            # Merge signals across all records in group
            merged_phone = next(
                (phones[i] for i in indices if phones[i]), None
            )
            merged_domain = next(
                (domains[i] for i in indices if domains[i]), None
            )
            merged_addr_hash = next(
                (addr_hashes[i] for i in indices if addr_hashes[i]), None
            )
            merged_gstin = next(
                (records[i].gstin for i in indices if records[i].gstin), None
            )
            merged_cin = next(
                (records[i].cin for i in indices if records[i].cin), None
            )

            # Identity confidence: higher when more sources agree
            source_names = list({records[i].source for i in indices})
            multi_source = len(source_names) > 1
            confidence = min(
                100.0,
                50.0
                + (30.0 if merged_phone else 0)
                + (15.0 if merged_domain else 0)
                + (10.0 if multi_source else 0)
                + (5.0 if merged_gstin else 0)
                + (5.0 if merged_cin else 0)
            )

            identity = LeadIdentity(
                normalized_name=_normalize_name(best.business_name),
                normalized_domain=merged_domain,
                normalized_phone=merged_phone,
                address_hash=merged_addr_hash,
                gstin=merged_gstin,
                cin=merged_cin,
                source_names=source_names,
                source_count=len(source_names),
                source_ids=[str(uuid.uuid4()) for _ in indices],  # Placeholder IDs
                raw_records=group_records,
                identity_confidence=confidence,
            )
            identities.append(identity)

        logger.info(
            f"[IdentityResolver] {len(records)} records → {len(identities)} identities"
        )
        return identities
