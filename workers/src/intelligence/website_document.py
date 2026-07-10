"""
website_document.py — WebsiteDocument dataclass.

Represents the fully enriched output of the 6-stage Website Intelligence Pipeline.
Every field is a ProvenanceField for full lineage tracking.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from discovery.provenance import ProvenanceDict, ProvenanceField


@dataclass
class WebsitePage:
    url: str
    title: str = ""
    page_type: str = "unknown"
    text: str = ""
    links: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    schema_jsonld: List[Dict[str, Any]] = field(default_factory=list)
    headings: List[str] = field(default_factory=list)
    forms: List[Dict[str, Any]] = field(default_factory=list)
    phones: List[str] = field(default_factory=list)
    emails: List[str] = field(default_factory=list)
    images: List[str] = field(default_factory=list)



@dataclass
class WebsiteDocument:
    """
    Fully parsed and enriched representation of a company website.
    Produced by WebsiteIntelligencePipeline.run().
    """

    # Core info
    url: str = ""
    domain: str = ""
    fetch_status: int = 0       # HTTP status code (0 = not fetched)
    pages_crawled: int = 0
    cached: bool = False        # Was this loaded from cache?
    pages: List[WebsitePage] = field(default_factory=list)

    # --- Meta section ---
    title: Optional[ProvenanceField] = None         # <title>
    meta_description: Optional[ProvenanceField] = None
    h1: Optional[ProvenanceField] = None
    language: Optional[ProvenanceField] = None

    # --- Text content ---
    hero_text: Optional[ProvenanceField] = None     # Above-the-fold text
    about_text: Optional[ProvenanceField] = None    # About/story section
    services: List[ProvenanceField] = field(default_factory=list)
    products: List[ProvenanceField] = field(default_factory=list)
    testimonials: List[ProvenanceField] = field(default_factory=list)
    faq: List[ProvenanceField] = field(default_factory=list)

    # --- Contact signals ---
    phones: List[ProvenanceField] = field(default_factory=list)
    emails: List[ProvenanceField] = field(default_factory=list)
    addresses: List[ProvenanceField] = field(default_factory=list)
    whatsapp_number: Optional[ProvenanceField] = None

    # --- Social links ---
    facebook_url: Optional[ProvenanceField] = None
    instagram_url: Optional[ProvenanceField] = None
    linkedin_url: Optional[ProvenanceField] = None
    twitter_url: Optional[ProvenanceField] = None
    youtube_url: Optional[ProvenanceField] = None

    # --- Business signals ---
    has_contact_form: bool = False
    has_whatsapp_widget: bool = False
    has_booking_system: bool = False
    has_crm_integration: bool = False
    has_live_chat: bool = False
    has_analytics: bool = False
    has_ecommerce: bool = False

    # --- Technology stack ---
    technology: List[ProvenanceField] = field(default_factory=list)

    # --- Leadership ---
    leadership: List[ProvenanceField] = field(default_factory=list)  # Names, titles

    # --- AI classification results (filled by Company Intelligence) ---
    industry: Optional[ProvenanceField] = None
    business_type: Optional[ProvenanceField] = None  # B2B | B2C | Both

    # --- Raw text (for NER) ---
    raw_text: str = ""

    # --- Metrics ---
    crawl_metrics: Dict[str, Any] = field(default_factory=dict)

    def to_legacy_dict(self) -> Dict[str, Any]:
        """
        Convert to the flat dict format expected by the existing Node.js pipeline.
        """
        def pf_val(pf: Optional[ProvenanceField]) -> Any:
            return pf.value if pf else None

        def pf_list_val(pfs: List[ProvenanceField]) -> List[Any]:
            return [pf.value for pf in pfs]

        return {
            "url": self.url,
            "domain": self.domain,
            "fetch_status": self.fetch_status,
            "pages_crawled": self.pages_crawled,
            "title": pf_val(self.title),
            "meta_description": pf_val(self.meta_description),
            "h1": pf_val(self.h1),
            "hero_text": pf_val(self.hero_text),
            "about_text": pf_val(self.about_text),
            "services": pf_list_val(self.services),
            "products": pf_list_val(self.products),
            "phones": pf_list_val(self.phones),
            "emails": pf_list_val(self.emails),
            "addresses": pf_list_val(self.addresses),
            "whatsapp_number": pf_val(self.whatsapp_number),
            "facebook_url": pf_val(self.facebook_url),
            "instagram_url": pf_val(self.instagram_url),
            "linkedin_url": pf_val(self.linkedin_url),
            "twitter_url": pf_val(self.twitter_url),
            "youtube_url": pf_val(self.youtube_url),
            "has_contact_form": self.has_contact_form,
            "has_whatsapp_widget": self.has_whatsapp_widget,
            "has_booking_system": self.has_booking_system,
            "has_crm_integration": self.has_crm_integration,
            "has_live_chat": self.has_live_chat,
            "has_analytics": self.has_analytics,
            "has_ecommerce": self.has_ecommerce,
            "technology": [t.value for t in self.technology],
            "leadership": pf_list_val(self.leadership),
            "industry": pf_val(self.industry),
            "business_type": pf_val(self.business_type),
            "raw_text": self.raw_text[:5000],
            "crawl_metrics": self.crawl_metrics,
            "pages": [p.__dict__ for p in self.pages],
        }

    def to_provenance_dict(self) -> Dict[str, Any]:
        """Return full provenance for all fields."""
        def pf_dict(pf: Optional[ProvenanceField]) -> Any:
            return pf.to_dict() if pf else None

        return {
            "url": self.url,
            "domain": self.domain,
            "title": pf_dict(self.title),
            "meta_description": pf_dict(self.meta_description),
            "h1": pf_dict(self.h1),
            "phones": [p.to_dict() for p in self.phones],
            "emails": [e.to_dict() for e in self.emails],
            "industry": pf_dict(self.industry),
            "technology": [t.to_dict() for t in self.technology],
            "business_signals": {
                "has_contact_form": self.has_contact_form,
                "has_whatsapp_widget": self.has_whatsapp_widget,
                "has_booking_system": self.has_booking_system,
                "has_crm_integration": self.has_crm_integration,
                "has_live_chat": self.has_live_chat,
                "has_analytics": self.has_analytics,
                "has_ecommerce": self.has_ecommerce,
            },
        }
