#!/usr/bin/env python3
"""
Discovery Runner — Unified Entry Point for Multi-Source Lead Discovery

Called from Node.js via child_process.spawn().
Reads JSON input from stdin, runs selected scrapers in parallel, outputs JSON to stdout.

Input (JSON from stdin):
{
    "keyword": "dentist",
    "city": "Mumbai",
    "sources": ["google_maps", "justdial", "indiamart", "tradeindia", "sulekha"],
    "max_results": 50
}

Output (JSON to stdout):
{
    "status": "completed",
    "results": [...],
    "errors": [...],
    "total_raw": 123,
    "per_source": { "google_maps": 30, "justdial": 25, ... }
}
"""

import asyncio
import json
import logging
import sys
import time
from typing import Dict, List, Any

# Configure logging to stderr so it doesn't interfere with JSON stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("discovery_runner")

# Scraper imports
from gmaps_scraper import scrape_google_maps
from duckduckgo_scraper import scrape_duckduckgo
from website_search_scraper import scrape_website_search
from grotal_scraper import scrape_grotal
from asklaila_scraper import scrape_asklaila
from yellowpages_scraper import scrape_yellowpages
from hotfrog_scraper import scrape_hotfrog

# Map source names to scraper functions
SCRAPER_MAP = {
    "google_maps": scrape_google_maps,
    "duckduckgo": scrape_duckduckgo,
    "website_search": scrape_website_search,
    "grotal": scrape_grotal,
    "asklaila": scrape_asklaila,
    "yellowpages": scrape_yellowpages,
    "hotfrog": scrape_hotfrog,
}

ALL_SOURCES = list(SCRAPER_MAP.keys())


async def run_scraper(
    source: str,
    keyword: str,
    city: str,
    max_results: int,
) -> Dict[str, Any]:
    """Run a single scraper and return structured results."""
    scraper_fn = SCRAPER_MAP.get(source)
    if not scraper_fn:
        return {
            "source": source,
            "results": [],
            "error": f"Unknown source: {source}",
            "duration_seconds": 0,
        }

    start_time = time.time()
    try:
        logger.info(f"Starting {source} scraper for '{keyword}' in '{city}'")
        results = await scraper_fn(keyword=keyword, city=city, max_results=max_results)
        duration = round(time.time() - start_time, 2)
        logger.info(f"{source} completed: {len(results)} results in {duration}s")
        return {
            "source": source,
            "results": results,
            "error": None,
            "duration_seconds": duration,
        }
    except Exception as e:
        duration = round(time.time() - start_time, 2)
        logger.error(f"{source} failed after {duration}s: {e}")
        return {
            "source": source,
            "results": [],
            "error": str(e),
            "duration_seconds": duration,
        }


async def run_discovery(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run multi-source discovery with given configuration.
    Scrapers run in parallel using asyncio.gather().
    """
    keyword = config.get("keyword", "")
    city = config.get("city", "")
    sources = config.get("sources", ALL_SOURCES)
    max_results = config.get("max_results", 50)

    if not keyword or not city:
        return {
            "status": "error",
            "error": "Both 'keyword' and 'city' are required",
            "results": [],
            "errors": [],
            "total_raw": 0,
            "per_source": {},
        }

    # Validate sources
    valid_sources = [s for s in sources if s in SCRAPER_MAP]
    invalid_sources = [s for s in sources if s not in SCRAPER_MAP]

    if invalid_sources:
        logger.warning(f"Ignoring unknown sources: {invalid_sources}")

    if not valid_sources:
        return {
            "status": "error",
            "error": f"No valid sources provided. Available: {ALL_SOURCES}",
            "results": [],
            "errors": [],
            "total_raw": 0,
            "per_source": {},
        }

    logger.info(
        f"Discovery starting: keyword='{keyword}', city='{city}', "
        f"sources={valid_sources}, max_results={max_results}"
    )

    # Run all scrapers in parallel
    tasks = [
        run_scraper(source, keyword, city, max_results)
        for source in valid_sources
    ]
    scraper_results = await asyncio.gather(*tasks)

    # Aggregate results
    all_results: List[Dict] = []
    all_errors: List[Dict] = []
    per_source: Dict[str, int] = {}

    for sr in scraper_results:
        source = sr["source"]
        per_source[source] = len(sr["results"])
        all_results.extend(sr["results"])

        if sr["error"]:
            all_errors.append({
                "source": source,
                "error": sr["error"],
                "duration_seconds": sr["duration_seconds"],
            })

    status = "completed" if not all_errors else "partial" if all_results else "failed"

    output = {
        "status": status,
        "results": all_results,
        "errors": all_errors,
        "total_raw": len(all_results),
        "per_source": per_source,
    }

    logger.info(
        f"Discovery {status}: {len(all_results)} total results, "
        f"{len(all_errors)} source errors"
    )

    return output


def main():
    """Entry point: read config from stdin, output results to stdout."""
    try:
        raw_input = sys.stdin.read()
        config = json.loads(raw_input)
    except json.JSONDecodeError as e:
        output = {
            "status": "error",
            "error": f"Invalid JSON input: {e}",
            "results": [],
            "errors": [],
            "total_raw": 0,
            "per_source": {},
        }
        print(json.dumps(output))
        sys.exit(1)

    result = asyncio.run(run_discovery(config))
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
