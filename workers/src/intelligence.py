import os
import json
import logging
import requests
from typing import List, Dict, Any
from pydantic import BaseModel, Field

# Patch for langchain_community compatibility if needed by other components
import sys
import types
try:
    import langchain_ollama
    if "langchain_community.chat_models" not in sys.modules:
        chat_models_module = types.ModuleType("langchain_community.chat_models")
        chat_models_module.ChatOllama = langchain_ollama.ChatOllama
        sys.modules["langchain_community.chat_models"] = chat_models_module
except ImportError:
    pass

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

logger = logging.getLogger(__name__)

class IntelligenceResult(BaseModel):
    score: int = Field(description="Lead score from 0 to 100 based on digital presence and missing features.", ge=0, le=100)
    servicesNeeded: List[str] = Field(description="List of recommended services based on the analysis")

def analyze_business(business_data: Dict[str, Any]) -> IntelligenceResult:
    """
    Analyzes business data to determine digital presence score and needed services.
    
    Checks for:
    - Website Exists?
    - WhatsApp Button?
    - Booking System?
    - CRM?
    - Social Profiles?
    """
    logger.info("Starting intelligence analysis on business data.")
    parser = JsonOutputParser(pydantic_object=IntelligenceResult)

    prompt_template = """
    You are an expert lead intelligence analyzer.
    Analyze the following business data to determine their digital presence score and services needed.
    
    Evaluate the following criteria based on the data provided:
    1. Website Exists?
    2. WhatsApp Button?
    3. Booking System?
    4. CRM (Customer Relationship Management) system in place?
    5. Social Profiles?

    Calculate a score from 0 to 100. A lower score indicates they lack many of these features (meaning they are a good lead for us to sell services to). A higher score means they have a strong digital presence.
    
    Determine the 'servicesNeeded' array. Possible services include (but are not limited to):
    - "Website Development" (if website is missing or poor)
    - "WhatsApp Integration" (if missing WhatsApp feature)
    - "Booking System Setup" (if missing booking functionality)
    - "CRM Implementation" (if missing CRM)
    - "Social Media Management" (if missing social profiles)

    Business Data:
    {business_data}

    {format_instructions}
    """

    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=openai_api_key, temperature=0)
        
        prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["business_data"],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )

        chain = prompt | llm | parser

        try:
            data_str = json.dumps(business_data, indent=2)
            result = chain.invoke({"business_data": data_str})
            
            # Ensure it matches the Pydantic model
            if isinstance(result, dict):
                return IntelligenceResult(**result)
            return result
        except Exception as e:
            logger.error(f"Failed to analyze business data: {e}")
            raise e
    else:
        llm_model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
        llm_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        
        prompt_text = prompt_template.format(
            business_data=json.dumps(business_data, indent=2),
            format_instructions=parser.get_format_instructions()
        )
        payload = {
            "model": llm_model,
            "prompt": prompt_text,
            "format": "json",
            "stream": False,
            "keep_alive": "24h"
        }
        try:
            res = requests.post(f"{llm_base_url}/api/generate", json=payload, timeout=60)
            res.raise_for_status()
            response_str = res.json().get("response", "")
            if response_str.startswith("```json"):
                response_str = response_str.replace("```json", "").replace("```", "").strip()
            elif response_str.startswith("```"):
                response_str = response_str.replace("```", "").strip()
            result = json.loads(response_str)
            if isinstance(result, dict):
                return IntelligenceResult(**result)
            return result
        except Exception as e:
            logger.error(f"Failed to analyze business data with Ollama: {e}")
            raise e
