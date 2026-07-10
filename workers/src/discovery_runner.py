#!/usr/bin/env python3
"""
discovery_runner.py — V2 Entry Point for Multi-Source Lead Discovery.

Called from Node.js via child_process.spawn().
Reads JSON input from stdin, runs all source plugins via DiscoverySourceManager,
outputs enriched JSON to stdout.

Input (JSON from stdin):
{
    "keyword": "dentist",
    "city": "Mumbai",
    "sources": ["google_maps", "overpass", "duckduckgo"],  // optional — defaults to all
    "max_results": 100
}

Output (JSON to stdout):
{
    "status": "completed" | "partial" | "failed",
    "results": [...],
    "errors": [...],
    "total_raw": 123,
    "per_source": { "google_maps": 45, "overpass": 32, ... },
    "telemetry": { ... },
    "source_reliability": { ... },
    "discovery_confidence": { ... }
}
"""

import asyncio
import json
import logging
import os
import sys

# Configure logging to stderr — never interferes with JSON stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("discovery_runner")

# Add src directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def run(config: dict) -> dict:
    from discovery.source_manager import DiscoverySourceManager

    keyword = config.get("keyword", "").strip()
    city = config.get("city", "").strip()
    sources = config.get("sources") or None  # None = run all
    max_results = int(config.get("max_results", 100))

    if not keyword or not city:
        return {
            "status": "error",
            "error": "Both 'keyword' and 'city' are required",
            "results": [],
            "errors": [],
            "total_raw": 0,
            "per_source": {},
        }

    logger.info(
        f"[runner] V2 discovery start: keyword='{keyword}', city='{city}', "
        f"sources={sources or 'ALL'}, max_results={max_results}"
    )

    manager = DiscoverySourceManager()
    output = await manager.run(
        keyword=keyword,
        city=city,
        max_results=max_results,
        requested_sources=sources,
    )

    logger.info(
        f"[runner] V2 discovery done: status={output['status']}, "
        f"results={len(output['results'])}"
    )
    return output


def main():
    try:
        raw = sys.stdin.read()
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        output = {
            "status": "error",
            "error": f"Invalid JSON input: {exc}",
            "results": [],
            "errors": [],
            "total_raw": 0,
            "per_source": {},
        }
        print(json.dumps(output))
        sys.exit(1)

    result = asyncio.run(run(config))
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
