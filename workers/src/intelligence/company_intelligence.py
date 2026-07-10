"""
company_intelligence.py — V2 Lead Intelligence engine.

Accepts a WebsiteDocument with full provenance.
Uses local AI (dslim/bert-base-NER, zero-shot classification) via local_ai_service.py
to extract business type, industry, and leadership.
Computes a confidence-aware Lead Score.
"""

import json
import logging
import requests
from typing import Dict, Any

from intelligence.website_document import WebsiteDocument
from discovery.provenance import ProvenanceField

logger = logging.getLogger(__name__)

LOCAL_AI_URL = "http://localhost:8000/infer"


class CompanyIntelligenceV2:
    def __init__(self):
        pass

    def run(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Accepts a serialized WebsiteDocument.
        Returns intelligence metrics and updated AI fields.
        """
        doc = WebsiteDocument(**{
            k: v for k, v in doc_data.items()
            if k in WebsiteDocument.__dataclass_fields__
        })

        # 1. AI Classification (Zero-shot)
        industry = self._classify_industry(doc)
        if industry:
            doc.industry = ProvenanceField(value=industry, source="ai_classification", confidence=85.0)

        biz_type = self._classify_business_type(doc)
        if biz_type:
            doc.business_type = ProvenanceField(value=biz_type, source="ai_classification", confidence=85.0)

        # 2. AI NER for Leadership (fallback if Stage 3 didn't find any)
        if not doc.leadership:
            leaders = self._extract_leaders(doc.raw_text)
            doc.leadership = [
                ProvenanceField(value=name, source="ai_ner", confidence=80.0)
                for name in leaders
            ]

        # 3. Confidence-aware Lead Score
        score_data = self._calculate_scores(doc)

        return {
            "intelligence": score_data,
            "document": doc.to_provenance_dict(),
        }

    def _classify_industry(self, doc: WebsiteDocument) -> str:
        text = (doc.hero_text.value if doc.hero_text else "") + " " + (doc.about_text.value if doc.about_text else "")
        if len(text) < 50:
            return ""
        
        try:
            payload = {
                "task": "classification",
                "payload": {
                    "inputs": text[:1000],
                    "parameters": {
                        "candidate_labels": [
                            "Healthcare & Dental", "IT & Software", "Manufacturing", 
                            "Real Estate", "Education", "Retail & E-commerce", 
                            "Consulting & Professional Services", "Travel & Hospitality"
                        ]
                    }
                }
            }
            resp = requests.post(LOCAL_AI_URL, json=payload, timeout=5)
            if resp.status_code == 200:
                res = resp.json()
                if res and "labels" in res and res["scores"][0] > 0.4:
                    return res["labels"][0]
        except Exception as exc:
            logger.debug(f"[CompanyIntelligence] Industry classification failed: {exc}")
        return ""

    def _classify_business_type(self, doc: WebsiteDocument) -> str:
        text = (doc.hero_text.value if doc.hero_text else "") + " " + (doc.about_text.value if doc.about_text else "")
        if len(text) < 50:
            return ""
        
        try:
            payload = {
                "task": "classification",
                "payload": {
                    "inputs": text[:1000],
                    "parameters": {
                        "candidate_labels": ["B2B", "B2C", "B2B2C"]
                    }
                }
            }
            resp = requests.post(LOCAL_AI_URL, json=payload, timeout=5)
            if resp.status_code == 200:
                res = resp.json()
                if res and "labels" in res and res["scores"][0] > 0.5:
                    return res["labels"][0]
        except Exception:
            pass
        return ""

    def _extract_leaders(self, text: str) -> list:
        if len(text) < 100:
            return []
        
        try:
            payload = {
                "task": "ner",
                "payload": {
                    "inputs": text[:2000]
                }
            }
            resp = requests.post(LOCAL_AI_URL, json=payload, timeout=8)
            if resp.status_code == 200:
                res = resp.json()
                names = []
                for entity in res:
                    if entity.get("entity_group") == "PER" and entity.get("score", 0) > 0.8:
                        names.append(entity.get("word"))
                # Deduplicate and clean
                return list(set([n.title() for n in names if len(n) > 3]))
        except Exception:
            pass
        return []

    def _calculate_scores(self, doc: WebsiteDocument) -> Dict[str, Any]:
        """
        Confidence-aware lead scoring.
        Lower digital maturity + high intent = high lead score.
        """
        maturity = 0
        intent = 0
        services_needed = []

        # Feature existence weights
        if doc.url:
            maturity += 20
        else:
            intent += 30  # Needs a website
            services_needed.append("Website Development")
            
        if doc.has_contact_form:
            maturity += 10
        
        if doc.has_whatsapp_widget:
            maturity += 15
        else:
            intent += 15
            services_needed.append("WhatsApp Automation")
            
        if doc.has_booking_system:
            maturity += 15
        
        if doc.has_crm_integration:
            maturity += 15
        else:
            intent += 10
            services_needed.append("CRM Implementation")
            
        if doc.has_ecommerce:
            maturity += 15
            
        if doc.technology:
            maturity += min(10, len(doc.technology) * 2)

        # Confidence penalty: if we have features but low confidence, maturity drops
        # Not applicable if features are purely boolean, but for phones/emails:
        contact_conf = sum(p.confidence for p in doc.phones) / max(1, len(doc.phones))
        if contact_conf < 50.0:
            maturity = max(0, maturity - 10)

        # Opportunity Score: How much do they need us?
        opportunity_score = 100 - maturity
        
        # Fit Score: Are they a real, contactable business?
        fit_score = 0
        if doc.phones:
            fit_score += 30
        if doc.emails:
            fit_score += 20
        if doc.addresses:
            fit_score += 15
        if doc.leadership:
            fit_score += 15
        if doc.industry:
            fit_score += 20

        # Composite Lead Score
        lead_score = round((intent * 0.35) + (opportunity_score * 0.35) + (fit_score * 0.30))
        
        return {
            "digital_maturity": maturity,
            "intent_score": min(100, intent),
            "opportunity_score": min(100, opportunity_score),
            "fit_score": min(100, fit_score),
            "lead_score": min(100, max(0, lead_score)),
            "services_needed": services_needed
        }

if __name__ == "__main__":
    import sys
    try:
        raw = sys.stdin.read()
        config = json.loads(raw)
        
        engine = CompanyIntelligenceV2()
        result = engine.run(config)
        
        print(json.dumps({"status": "completed", "result": result}))
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
