import sys
import os
import asyncio
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv
load_dotenv()

from ai.SearchRouter import SearchRouter
from ai.SearchPlanner import SearchPlanner

logging.basicConfig(level=logging.INFO)

async def main():
    router = SearchRouter()
    print("Testing SearchRouter for 'hospitals delhi'...")
    queries = SearchPlanner.expand_query("hospitals", "delhi")
    print("Queries:", queries)
    records = await router.execute_search(
        queries=queries[:2], # Just test first two
        city="delhi",
        target_results=20,
        discovered_companies=[],
        coverage_score_before=0,
        timeout_sec=300
    )
    
    print(f"Total verified records found: {len(records)}")
    if records:
        print(f"Sample source: {records[0].source}")

if __name__ == "__main__":
    asyncio.run(main())
