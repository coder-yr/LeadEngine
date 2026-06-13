import os
import logging
from typing import List, Optional
from pydantic import BaseModel, Field

# Patch for scrapegraphai to fix ChatOllama import from langchain_community
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

from scrapegraphai.graphs import SmartScraperGraph
logger = logging.getLogger(__name__)

class BusinessExtraction(BaseModel):
    """
    Pydantic model representing the extracted business intelligence.
    """
    business_name: Optional[str] = Field(None, description="The name of the business")
    phone: Optional[str] = Field(None, description="Contact phone number")
    email: Optional[str] = Field(None, description="Contact email address")
    address: Optional[str] = Field(None, description="Physical address of the business")
    website: Optional[str] = Field(None, description="The primary website URL")
    social_links: List[str] = Field(default_factory=list, description="List of social media profile URLs")

def extract_business_info(url: str) -> BusinessExtraction:
    """
    Extracts business information from a given URL using ScrapeGraphAI.
    
    Args:
        url (str): The target website URL to extract data from.
        
    Returns:
        BusinessExtraction: A populated Pydantic model containing the extracted data.
    """
    logger.info(f"Starting ScrapeGraphAI extraction for: {url}")
    
    # Configure the LLM for ScrapeGraphAI based on environment variables
    # Defaults to Ollama for local execution, or falls back to OpenAI if configured
    llm_model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
    llm_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    
    if openai_api_key:
        graph_config = {
            "llm": {
                "api_key": openai_api_key,
                "model": "openai/gpt-4o-mini",
            },
            "verbose": False,
            "headless": True
        }
    else:
        graph_config = {
            "llm": {
                "model": f"ollama/{llm_model}",
                "base_url": llm_base_url,
            },
            "embeddings": {
                "model": "ollama/nomic-embed-text",
                "base_url": llm_base_url,
            },
            "verbose": False,
            "headless": True
        }

    prompt = (
        "Extract the following information from the website: "
        "Business Name, Contact Phone Number, Contact Email Address, Physical Address, "
        "The Website URL, and a list of all Social Media Links."
    )

    try:
        # Initialize the SmartScraperGraph
        smart_scraper_graph = SmartScraperGraph(
            prompt=prompt,
            source=url,
            config=graph_config,
            schema=BusinessExtraction
        )
        
        # Run the graph extraction
        result_dict = smart_scraper_graph.run()
        
        # Ensure the response is properly parsed into our Pydantic model
        if isinstance(result_dict, BusinessExtraction):
            return result_dict
            
        if isinstance(result_dict, dict):
            return BusinessExtraction(**result_dict)
            
        logger.warning(f"Unexpected return type from ScrapeGraphAI: {type(result_dict)}")
        return BusinessExtraction()
        
    except Exception as e:
        logger.error(f"Failed to extract info from {url} using ScrapeGraphAI: {e}")
        raise e
