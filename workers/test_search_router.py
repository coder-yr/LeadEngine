import sys
import os
import asyncio
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv
load_dotenv()

from ai.SearchRouter import SearchRouter

logging.basicConfig(level=logging.INFO)

async def main():
    router = SearchRouter()
    print("Testing SearchRouter for 'dentist delhi'...")
    records = await router.execute_search(
        queries=["dentist delhi", "dental clinic delhi"],
        city="delhi",
        target_results=50,
        discovered_companies=[],
        coverage_score_before=0,
        timeout_sec=300
    )
    
    print(f"Total verified records found: {len(records)}")

if __name__ == "__main__":
    asyncio.run(main())
