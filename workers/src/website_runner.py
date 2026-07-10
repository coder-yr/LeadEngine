#!/usr/bin/env python3
"""
website_runner.py — Entry Point for Website Intelligence Pipeline.

Reads JSON input from stdin (URL), runs the 6-stage pipeline, and outputs JSON.
"""

import json
import logging
import os
import sys
import asyncio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("website_runner")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    try:
        raw = sys.stdin.read()
        config = json.loads(raw)
    except Exception as exc:
        print(json.dumps({"status": "error", "error": f"Invalid JSON: {exc}"}))
        sys.exit(1)

    url = config.get("url")
    if not url:
        print(json.dumps({"status": "error", "error": "URL is required"}))
        sys.exit(1)

    try:
        from intelligence.website_intelligence_v2 import WebsiteIntelligencePipelineV2
        pipeline = WebsiteIntelligencePipelineV2(max_pages=5)
        doc = asyncio.run(pipeline.run(url))
        print(json.dumps({
            "status": "completed" if doc.fetch_status == 200 else "failed",
            "document": doc.to_provenance_dict(),
            "legacy": doc.to_legacy_dict(),
        }))
    except Exception as exc:
        logger.error(f"Pipeline failed: {exc}", exc_info=True)
        print(json.dumps({"status": "error", "error": str(exc)}))


if __name__ == "__main__":
    main()
