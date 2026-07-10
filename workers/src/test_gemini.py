import asyncio
import logging
import os
import json
import sys

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from discovery.sources.gemini_search import GeminiSearchSource
from dotenv import load_dotenv

# Set up logging to see what's happening
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

async def test_gemini():
    # Load environment variables (ensure GEMINI_API_KEY is in workers/.env)
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    
    print("===========================================")
    print("Testing Adaptive Gemini Discovery Source")
    print("===========================================")
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY is missing in your .env file!")
        return

    # Initialize the source
    gemini_source = GeminiSearchSource()
    
    # We pretend we already discovered one clinic to test deduplication
    already_discovered = ["Smile Care Clinic"]
    
    print("\n[Test] Running Gemini Search for 'Dentist' in 'Mumbai'...")
    print(f"[Test] Already discovered (should be excluded): {already_discovered}")
    
    # Run the safe_search method
    try:
        results = await gemini_source.safe_search(
            keyword="Dentist",
            city="Mumbai",
            max_results=3,
            discovered_companies=already_discovered
        )
        
        print("\n===========================================")
        print(f"Test Complete! Found {len(results)} companies.")
        print("===========================================")
        
        for i, rec in enumerate(results):
            print(f"\nResult {i+1}:")
            print(f"  Name:       {rec.business_name}")
            print(f"  Website:    {rec.website}")
            print(f"  Phone:      {rec.phone}")
            print(f"  Address:    {rec.address}")
            print(f"  Confidence: {rec.quality_score}")
            print(f"  Provider:   {rec.metadata.get('provider')}")
            print(f"  Query Used: {rec.metadata.get('searchQuery')}")
            
    except Exception as e:
        print(f"\nTest Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini())
