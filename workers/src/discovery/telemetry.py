"""
telemetry.py — Tracks discovery run metrics and computes discovery confidence.

Telemetry is attached to every discovery runner output so the Node.js backend
can display per-source timing, success rates, and pipeline confidence.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class SourceTelemetry:
    """Telemetry for a single source run."""
    source: str
    tier: int
    duration_sec: float
    results_count: int
    contacts_found: int        # results with phone
    websites_found: int        # results with website
    duplicate_count: int       # marked as dupes during merge
    success: bool
    blocked: bool = False
    error: Optional[str] = None


@dataclass
class DiscoveryTelemetry:
    """Full telemetry for a complete discovery run."""
    keyword: str
    city: str
    total_duration_sec: float = 0.0
    sources_attempted: int = 0
    sources_succeeded: int = 0
    sources_failed: int = 0
    sources_blocked: int = 0
    total_raw_results: int = 0
    total_after_dedup: int = 0
    total_contacts: int = 0
    total_websites: int = 0
    website_crawl_time_sec: float = 0.0
    contact_extraction_time_sec: float = 0.0
    audit_time_sec: float = 0.0
    ner_time_sec: float = 0.0
    ollama_time_sec: float = 0.0
    per_source: List[SourceTelemetry] = field(default_factory=list)

    def add_source(self, st: SourceTelemetry) -> None:
        self.per_source.append(st)
        self.sources_attempted += 1
        self.total_raw_results += st.results_count
        self.total_contacts += st.contacts_found
        self.total_websites += st.websites_found
        if st.success:
            self.sources_succeeded += 1
        else:
            self.sources_failed += 1
        if st.blocked:
            self.sources_blocked += 1

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # Convert SourceTelemetry list to plain dicts
        d["per_source"] = [asdict(s) for s in self.per_source]
        return d


@dataclass
class DiscoveryConfidence:
    """
    Per-lead confidence signal — how complete is the data we found?
    Each boolean flag adds to the overall_confidence score.
    """
    website_exists: bool = False
    leadership_found: bool = False
    phone_found: bool = False
    email_found: bool = False
    social_found: bool = False
    business_contacts_found: bool = False
    technology_detected: bool = False
    audit_completed: bool = False
    identity_resolved: bool = False
    multi_source_confirmed: bool = False   # same company found in 2+ sources

    @property
    def overall_confidence(self) -> float:
        """
        Compute 0–100 score.
        Weights: phone/email most critical, multi-source a strong bonus.
        """
        weights = {
            "phone_found": 20,
            "website_exists": 18,
            "email_found": 15,
            "multi_source_confirmed": 12,
            "audit_completed": 10,
            "social_found": 8,
            "business_contacts_found": 7,
            "leadership_found": 5,
            "technology_detected": 3,
            "identity_resolved": 2,
        }
        score = sum(
            weight
            for attr, weight in weights.items()
            if getattr(self, attr, False)
        )
        return float(min(100, score))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "website_exists": self.website_exists,
            "leadership_found": self.leadership_found,
            "phone_found": self.phone_found,
            "email_found": self.email_found,
            "social_found": self.social_found,
            "business_contacts_found": self.business_contacts_found,
            "technology_detected": self.technology_detected,
            "audit_completed": self.audit_completed,
            "identity_resolved": self.identity_resolved,
            "multi_source_confirmed": self.multi_source_confirmed,
            "overall_confidence": self.overall_confidence,
        }


class TelemetryTracker:
    """Context manager for tracking timing of pipeline stages."""

    def __init__(self, label: str):
        self.label = label
        self._start: float = 0.0
        self.elapsed_sec: float = 0.0

    def __enter__(self) -> "TelemetryTracker":
        self._start = time.time()
        return self

    def __exit__(self, *args: Any) -> None:
        self.elapsed_sec = round(time.time() - self._start, 3)
