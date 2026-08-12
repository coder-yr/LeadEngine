import logging

logger = logging.getLogger(__name__)

class SearchPlanner:
    """
    Expands a core intent into multiple high-value semantic queries.
    This replaces the hardcoded query generation previously found in GeminiSource.
    """
    
    @classmethod
    def expand_query(cls, keyword: str, city: str) -> list[str]:
        """
        Takes a base keyword and city and returns a list of highly targeted semantic queries.
        In a full commercial system, this would use a fast local LLM (like Llama 3 8B via Ollama).
        For now, we use deterministic mapping for speed and reliability.
        """
        kw = keyword.lower()
        base = f"{keyword} {city}"
        
        if "dentist" in kw or "dental" in kw:
            return [
                base,
                f"Dental Clinic {city}"
            ]
        elif "hotel" in kw:
            return [
                base,
                f"Boutique Hotel {city}"
            ]
        elif "lawyer" in kw or "advocate" in kw or "law firm" in kw:
            return [
                base,
                f"Law Firm {city}"
            ]
        elif "restaurant" in kw or "cafe" in kw:
            return [
                base,
                f"Top rated restaurants {city}"
            ]
        elif "gym" in kw or "fitness" in kw:
            return [
                base,
                f"Fitness Center {city}"
            ]
        elif "ca " in kw or "chartered accountant" in kw:
            return [
                base,
                f"Accounting Firm {city}"
            ]
            
        # Default fallback expands with typical prefixes/suffixes to trigger more SERPs
        return [
            base, 
            f"Top {keyword} in {city}"
        ]
