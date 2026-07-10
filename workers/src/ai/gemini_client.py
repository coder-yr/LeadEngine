import os
import json
import logging
import asyncio
from typing import Any, Dict, Optional

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

class GeminiError(Exception):
    """Base exception for Gemini Client errors."""
    pass

class GeminiRateLimitError(GeminiError):
    """Exception raised for 429 Rate Limit errors."""
    pass

class GeminiClient:
    """
    Intelligent abstraction for the Gemini API.
    Handles Search Grounding, Retries, Rate Limits, and JSON Parsing.
    """
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("GEMINI_API_KEY is not set. GeminiSearchSource will fail.")
        
        self.model = os.getenv("MODEL", "gemini-2.5-flash")
        
        # Initialize GenAI Client
        # The client will automatically pick up GEMINI_API_KEY from environment
        try:
            self.client = genai.Client()
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Client: {e}")
            self.client = None

    async def generate_json_with_search(
        self, 
        prompt: str, 
        max_retries: int = 3,
        timeout: int = 60
    ) -> Any:
        """
        Executes a prompt using Gemini with Google Search Grounding.
        Returns the parsed JSON response.
        """
        if not self.client:
            raise GeminiError("Gemini Client not initialized.")

        attempt = 0
        backoff = 2

        config = types.GenerateContentConfig(
            tools=[{"google_search": {}}],
            temperature=0.2, # Low temperature for more deterministic output
        )

        while attempt < max_retries:
            attempt += 1
            try:
                # Wrap the sync call in to_thread to prevent blocking the async loop
                response = await asyncio.to_thread(
                    self._call_api_sync,
                    prompt,
                    config
                )
                
                # Parse JSON
                return self._parse_response(response.text)

            except Exception as e:
                error_msg = str(e)
                logger.warning(f"[GeminiClient] Attempt {attempt}/{max_retries} failed: {error_msg}")
                
                if "429" in error_msg or "quota" in error_msg.lower():
                    if attempt == max_retries:
                        raise GeminiRateLimitError("Gemini Quota Exceeded")
                elif attempt == max_retries:
                    raise GeminiError(f"Failed after {max_retries} attempts. Last error: {error_msg}")
                
                # Exponential backoff
                await asyncio.sleep(backoff)
                backoff *= 2

    def _call_api_sync(self, prompt: str, config: Any):
        """Synchronous API call to Gemini."""
        return self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=config
        )

    def _parse_response(self, text: Optional[str]) -> Any:
        """Extracts and parses JSON from the response text."""
        if not text:
            raise GeminiError("Empty response from Gemini")
            
        try:
            # Often LLMs wrap JSON in ```json ... ```
            cleaned = text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
                
            return json.loads(cleaned.strip())
        except json.JSONDecodeError as e:
            logger.error(f"[GeminiClient] Failed to parse JSON: {text[:200]}...")
            raise GeminiError(f"Malformed JSON response: {e}")
