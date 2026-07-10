"""
base_source.py — Abstract base class for all discovery source adapters.

Every discovery source MUST:
  1. Subclass BaseDiscoverySource
  2. Define class-level attributes: name, tier, reliability_stars
  3. Implement the async search() method
  4. Never raise — catch all exceptions internally and return []

Adding a new source requires only creating one .py file in discovery/sources/.
The PluginLoader will auto-discover it.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class DiscoveryRecord:
    """
    Standardized record returned by every discovery source.
    All fields are optional except business_name and source.
    """

    business_name: str
    source: str

    # Contact info
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None

    # Metadata
    rating: Optional[str] = None
    category: Optional[str] = None
    gstin: Optional[str] = None
    cin: Optional[str] = None

    # Platform-specific (social sources)
    platform: Optional[str] = None  # "facebook" | "instagram" | "linkedin"
    profile_url: Optional[str] = None

    # Computed
    quality_score: int = 0
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def to_legacy_dict(self) -> Dict[str, Any]:
        """
        Convert to the legacy dict format expected by discovery.service.ts.
        Maintains backward compatibility.
        """
        return {
            "Business Name": self.business_name,
            "Phone": self.phone or "",
            "Email": self.email or "",
            "Website": self.website or "",
            "Address": self.address or "",
            "Rating": self.rating or "",
            "Category": self.category or "",
            "source": self.source,
            "quality_score": self.quality_score,
            **self.raw_data,
        }


class BaseDiscoverySource(ABC):
    """
    Abstract base class for all discovery source adapters.

    Class-level attributes (override in subclass):
        name (str):  Unique identifier, matches the file name. Used as source key.
        tier (int):  1 = highest priority, 2 = secondary, 3 = optional/fallback.
        reliability_stars (int): Initial reliability rating 1-5 (overridden by engine).

    Contract:
        - search() must never raise. Catch all exceptions internally.
        - On failure, log the error and return [].
        - Never block the pipeline.
    """

    name: str = "base"
    tier: int = 3
    reliability_stars: int = 3

    @abstractmethod
    async def search(
        self,
        keyword: str,
        city: str,
        max_results: int,
        **kwargs
    ) -> List[DiscoveryRecord]:
        """
        Search for businesses matching keyword in city.

        Args:
            keyword: Business type or search term (e.g. "dentist")
            city:    Location (e.g. "Mumbai")
            max_results: Maximum number of results to return

        Returns:
            List of DiscoveryRecord. Empty list on any failure.
        """

    async def safe_search(
        self,
        keyword: str,
        city: str,
        max_results: int,
        **kwargs
    ) -> List[DiscoveryRecord]:
        """
        Wraps search() with top-level exception safety.
        Called by SourceManager — never call search() directly in production.
        """
        try:
            results = await self.search(keyword, city, max_results, **kwargs)
            return results or []
        except Exception as exc:
            logger.error(
                f"[{self.name}] Unhandled exception in safe_search: {exc}",
                exc_info=True,
            )
            return []

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name!r} tier={self.tier}>"
