"""
company_intelligence.py — V2 Lead Intelligence engine (Phase 7 & 8).

Accepts a WebsiteDocument with full provenance.
Uses Local AI (Ollama qwen3:8b) for NER and Business Intelligence generation.
"""

import json
import logging
import re
import requests
from typing import Dict, Any

from intelligence.website_document import WebsiteDocument
from discovery.provenance import ProvenanceField

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen3:8b"

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

        text_to_analyze = doc.raw_text[:8000] if doc.raw_text else ""

        if text_to_analyze:
            # Phase 7: Local AI NER for Leadership extraction
            if not doc.leadership:
                leaders = self._extract_leaders(text_to_analyze)
                for leader in leaders:
                    doc.leadership.append(ProvenanceField(value=leader, source="local_ai_ner", confidence=85.0))

            # Phase 8: Business Intelligence Generation
            bi = self._generate_business_intelligence(text_to_analyze)
            
            if bi.get("industry"):
                doc.industry = ProvenanceField(value=bi["industry"], source="local_ai", confidence=90.0)
            if bi.get("business_type"):
                doc.business_type = ProvenanceField(value=bi["business_type"], source="local_ai", confidence=90.0)
            
            # Store full AI Insights on the document (adding to crawl_metrics for now, later a separate field)
            doc.crawl_metrics["ai_insights"] = bi

        # Confidence-aware Lead Score
        score_data = self._calculate_scores(doc)

        return {
            "intelligence": score_data,
            "document": doc.to_provenance_dict(),
        }

    def _call_ollama(self, prompt: str) -> str:
        try:
            payload = {
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "temperature": 0.1
            }
            resp = requests.post(OLLAMA_URL, json=payload, timeout=30)
            if resp.status_code == 200:
                return resp.json().get("response", "")
        except Exception as e:
            logger.error(f"[Ollama] Failed to call local AI: {e}")
        return ""

    def _extract_leaders(self, text: str) -> list:
        prompt = f"""
You are an expert Named Entity Recognition system. Extract the names of key leadership figures (e.g., Founder, CEO, Director, Doctor, Dentist, Partner, Owner, Manager) from the following website text.
Return ONLY a comma-separated list of names with their titles. No other text. For example: "Dr. Rakesh Shah (Founder), Alice Smith (CEO)". If none found, return "None".

Website Text:
{text[:4000]}
"""
        response = self._call_ollama(prompt)
        if not response or response.strip().lower() == "none":
            return []
        
        leaders = [l.strip() for l in response.split(",") if len(l.strip()) > 3]
        return leaders

    def _generate_business_intelligence(self, text: str) -> Dict[str, Any]:
        prompt = f"""
Analyze the following company website text and extract structured Business Intelligence.
Return your answer strictly in valid JSON format with the following keys:
"industry" (string, e.g., "Healthcare & Dental", "IT Services"),
"business_type" (string, "B2B", "B2C", or "B2B2C"),
"company_size" (string, e.g., "Small", "Medium", "Enterprise", or "Unknown"),
"target_audience" (string),
"icp" (string, Ideal Customer Profile),
"unique_selling_points" (list of 3 strings),
"brand_tone" (string).

Website Text:
{text[:6000]}
"""
        response = self._call_ollama(prompt)
        # Attempt to parse JSON
        try:
            # Strip markdown code blocks if present
            response = re.sub(r'```json\n|```\n?', '', response).strip()
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"[Ollama] Failed to parse JSON from AI: {e} | Raw: {response}")
            return {}

    def _calculate_scores(self, doc: WebsiteDocument) -> Dict[str, Any]:
        maturity = 20 if doc.url else 0
        intent = 30 if not doc.url else 0
        
        if doc.has_contact_form: maturity += 10
        if doc.has_whatsapp_widget: maturity += 15
        if doc.has_booking_system: maturity += 15
        if doc.has_crm_integration: maturity += 15
        if doc.has_ecommerce: maturity += 15
        if doc.technology: maturity += min(10, len(doc.technology) * 2)

        opportunity_score = 100 - maturity
        
        fit_score = 0
        if doc.phones: fit_score += 30
        if doc.emails: fit_score += 20
        if doc.addresses: fit_score += 15
        if doc.leadership: fit_score += 15
        if doc.industry: fit_score += 20

        lead_score = round((intent * 0.35) + (opportunity_score * 0.35) + (fit_score * 0.30))
        
        return {
            "digital_maturity": min(100, maturity),
            "intent_score": min(100, intent),
            "opportunity_score": min(100, max(0, opportunity_score)),
            "fit_score": min(100, fit_score),
            "lead_score": min(100, max(0, lead_score)),
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
