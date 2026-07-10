"""
provenance.py — Result provenance tracking.

Every extracted field should be a ProvenanceField so we can trace:
  - Where did this value come from?
  - How confident are we?
  - When was it extracted?

Example usage:
    phone = ProvenanceField(
        value="+919876543210",
        source="google_maps",
        confidence=98.0,
    )

    industry = ProvenanceField(
        value="Healthcare",
        source="ModernBERT",
        confidence=93.0,
    )
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ProvenanceField:
    """A single extracted field with full lineage."""

    value: Any
    source: str                  # "google_maps" | "regex" | "NER" | "ModernBERT" | ...
    confidence: float            # 0.0 – 100.0
    extracted_at: str = field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "value": self.value,
            "source": self.source,
            "confidence": self.confidence,
            "extracted_at": self.extracted_at,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ProvenanceField":
        return cls(
            value=d["value"],
            source=d["source"],
            confidence=d["confidence"],
            extracted_at=d.get("extracted_at", ""),
        )

    def __repr__(self) -> str:
        return f"ProvenanceField({self.value!r}, src={self.source!r}, conf={self.confidence:.1f})"


class ProvenanceDict(dict):
    """
    Dict where values are ProvenanceField instances.
    Provides convenience methods for multi-source field resolution.

    Usage:
        d = ProvenanceDict()
        d["phone"] = ProvenanceField("+919876543210", "google_maps", 98)
        d["phone"] = ProvenanceField("+919876543210", "website", 85)  # merged
        print(d.best("phone"))  # returns the highest-confidence field
    """

    def set_field(self, key: str, pf: ProvenanceField) -> None:
        """
        Set a field. If the field already exists, keep the higher-confidence value.
        Accumulates all seen ProvenanceFields in _history for fusion.
        """
        if not hasattr(self, "_history"):
            object.__setattr__(self, "_history", {})

        if key not in self._history:
            self._history[key] = []
        self._history[key].append(pf)

        existing = self.get(key)
        if existing is None or pf.confidence > existing.confidence:
            self[key] = pf

    def best(self, key: str) -> Optional[Any]:
        """Return the best (highest-confidence) value for a key."""
        pf: Optional[ProvenanceField] = self.get(key)
        return pf.value if pf else None

    def all_candidates(self, key: str) -> List[ProvenanceField]:
        """Return all ProvenanceField candidates seen for a key (for fusion)."""
        if not hasattr(self, "_history"):
            return []
        return self._history.get(key, [])

    def to_plain_dict(self) -> Dict[str, Any]:
        """Serialize to JSON-safe dict."""
        return {k: v.to_dict() if isinstance(v, ProvenanceField) else v for k, v in self.items()}
