"""
confidence_fusion.py — Merges multi-source field values into a single fused result.

When Google Maps says "Dentist", the website says "Dental Hospital",
and ModernBERT says "Healthcare" — this engine fuses them into:
  { value: "Healthcare", confidence: 96, sources: ["google_maps", "website", "ModernBERT"] }

Algorithm: Weighted voting
  1. Normalize all candidate values to a canonical form
  2. Group candidates by canonical value
  3. Sum weighted confidences per group
  4. Return the group with the highest total weighted confidence
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from discovery.provenance import ProvenanceField


# Source trust weights — higher = more trusted
SOURCE_WEIGHTS: Dict[str, float] = {
    "google_maps":    1.00,
    "website":        1.00,
    "ModernBERT":     0.95,
    "overpass":       0.90,
    "zauba":          0.90,
    "mca":            0.90,
    "gst":            0.88,
    "duckduckgo":     0.80,
    "google_dorks":   0.78,
    "NER":            0.75,
    "regex":          0.70,
    "indiamart_rss":  0.65,
    "sulekha":        0.60,
    "facebook":       0.55,
    "instagram":      0.50,
    "linkedin":       0.55,
    "wayback":        0.50,
    "grotal":         0.40,
    "asklaila":       0.40,
    "yellowpages":    0.40,
    "hotfrog":        0.40,
    "justdial":       0.40,
}

# Industry normalization map — maps raw values to canonical categories
INDUSTRY_NORMALIZATION: Dict[str, str] = {
    "dentist": "Healthcare",
    "dental": "Healthcare",
    "dental hospital": "Healthcare",
    "dental clinic": "Healthcare",
    "clinic": "Healthcare",
    "hospital": "Healthcare",
    "doctor": "Healthcare",
    "medical": "Healthcare",
    "pharmacy": "Healthcare",
    "healthcare": "Healthcare",
    "school": "Education",
    "college": "Education",
    "university": "Education",
    "coaching": "Education",
    "tuition": "Education",
    "education": "Education",
    "restaurant": "Food & Beverage",
    "cafe": "Food & Beverage",
    "hotel": "Hospitality",
    "resort": "Hospitality",
    "lawyer": "Legal",
    "advocate": "Legal",
    "law firm": "Legal",
    "legal": "Legal",
    "architect": "Architecture & Design",
    "interior designer": "Architecture & Design",
    "construction": "Construction",
    "real estate": "Real Estate",
    "property": "Real Estate",
    "gym": "Fitness & Wellness",
    "fitness": "Fitness & Wellness",
    "salon": "Beauty & Wellness",
    "spa": "Beauty & Wellness",
    "software": "Technology",
    "it services": "Technology",
    "technology": "Technology",
    "digital marketing": "Marketing",
    "marketing": "Marketing",
    "ca": "Financial Services",
    "chartered accountant": "Financial Services",
    "accountant": "Financial Services",
    "finance": "Financial Services",
    "insurance": "Financial Services",
    "manufacturer": "Manufacturing",
    "manufacturing": "Manufacturing",
    "wholesale": "Wholesale & Distribution",
    "distributor": "Wholesale & Distribution",
    "retailer": "Retail",
    "shop": "Retail",
    "store": "Retail",
    "transport": "Logistics & Transport",
    "logistics": "Logistics & Transport",
    "courier": "Logistics & Transport",
    "event": "Events & Entertainment",
    "wedding": "Events & Entertainment",
    "photography": "Events & Entertainment",
}


@dataclass
class FusedField:
    """Result of fusing multiple candidate ProvenanceFields."""
    value: Any
    confidence: float          # 0–100 fused score
    sources: List[str]
    candidate_count: int

    def to_provenance_field(self) -> ProvenanceField:
        return ProvenanceField(
            value=self.value,
            source=", ".join(self.sources),
            confidence=self.confidence,
        )


class ConfidenceFusionEngine:
    """
    Fuses multiple ProvenanceField candidates for the same logical field
    into a single authoritative value.
    """

    def __init__(
        self,
        normalization_map: Optional[Dict[str, str]] = None,
        source_weights: Optional[Dict[str, float]] = None,
    ):
        self._norm_map = normalization_map or INDUSTRY_NORMALIZATION
        self._weights = source_weights or SOURCE_WEIGHTS

    def _normalize(self, value: Any) -> str:
        """Normalize a value for grouping."""
        if value is None:
            return ""
        s = str(value).strip().lower()
        return self._norm_map.get(s, s)

    def _weight(self, source: str) -> float:
        """Get trust weight for a source. Default 0.5 if unknown."""
        return self._weights.get(source.lower(), 0.50)

    def fuse(self, candidates: List[ProvenanceField]) -> Optional[FusedField]:
        """
        Fuse a list of ProvenanceField candidates into one winner.

        Steps:
          1. Normalize all values to canonical form
          2. Group by canonical value
          3. Compute weighted_confidence = sum(confidence * weight) per group
          4. Return the group with highest weighted_confidence

        Returns None if candidates is empty.
        """
        if not candidates:
            return None

        # Group by normalized value
        groups: Dict[str, List[ProvenanceField]] = defaultdict(list)
        for pf in candidates:
            norm = self._normalize(pf.value)
            if norm:
                groups[norm].append(pf)

        if not groups:
            return None

        # Score each group
        best_norm: Optional[str] = None
        best_score = -1.0

        for norm_value, pfs in groups.items():
            # Weighted sum of confidences in this group
            weighted_sum = sum(
                (pf.confidence / 100.0) * self._weight(pf.source)
                for pf in pfs
            )
            # Normalize to 0-100, boost for multi-source agreement
            num_sources = len(pfs)
            agreement_bonus = min(10.0, (num_sources - 1) * 3.0)
            score = min(100.0, (weighted_sum / num_sources * 100) + agreement_bonus)

            if score > best_score:
                best_score = score
                best_norm = norm_value

        if best_norm is None:
            return None

        winning_pfs = groups[best_norm]

        # Pick the best display value (highest original confidence among winners)
        best_display = max(winning_pfs, key=lambda p: p.confidence)

        return FusedField(
            value=best_display.value,
            confidence=round(best_score, 1),
            sources=list({pf.source for pf in winning_pfs}),
            candidate_count=len(candidates),
        )

    def fuse_phone(self, candidates: List[ProvenanceField]) -> Optional[FusedField]:
        """
        Phone-specific fusion: group by last-10-digits, not normalized string.
        """
        if not candidates:
            return None

        import re

        def norm_phone(val: Any) -> str:
            digits = re.sub(r"\D", "", str(val or ""))
            return digits[-10:] if len(digits) >= 10 else digits

        groups: Dict[str, List[ProvenanceField]] = defaultdict(list)
        for pf in candidates:
            norm = norm_phone(pf.value)
            if norm:
                groups[norm].append(pf)

        if not groups:
            return None

        best_norm = max(groups, key=lambda n: sum(
            (p.confidence / 100.0) * self._weight(p.source) for p in groups[n]
        ))
        winning_pfs = groups[best_norm]
        best_display = max(winning_pfs, key=lambda p: p.confidence)

        num_sources = len(winning_pfs)
        agreement_bonus = min(5.0, (num_sources - 1) * 2.0)
        score = min(100.0, best_display.confidence + agreement_bonus)

        return FusedField(
            value=best_display.value,
            confidence=round(score, 1),
            sources=list({p.source for p in winning_pfs}),
            candidate_count=len(candidates),
        )
