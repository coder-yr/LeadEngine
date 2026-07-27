import asyncio
import logging
from discovery.sources.google_maps import GoogleMapsSource

logging.basicConfig(level=logging.INFO)

async def test():
    source = GoogleMapsSource()
    print("Testing google_maps for hospitals in Mumbai...")
    results = await source.search("hospitals", "Mumbai", max_results=10)
    print(f"Found {len(results)} results")
    for r in results:
        print(f" - {r.business_name} ({r.website})")

if __name__ == "__main__":
    asyncio.run(test())
