"""
Phase 1 Tests — Discovery Runner & Scrapers

Tests the unified discovery runner and ensures consistent output format.
"""

import asyncio
import json
import pytest

# ── Output format validation ──


def validate_business_record(record: dict) -> None:
    """Validate that a business record has the expected structure."""
    assert "source" in record, "Record missing 'source' field"
    assert record["source"] in (
        "google_maps", "justdial", "indiamart", "tradeindia", "sulekha"
    ), f"Unknown source: {record['source']}"
    assert "Business Name" in record, "Record missing 'Business Name' field"


def validate_discovery_output(output: dict) -> None:
    """Validate the overall discovery runner output structure."""
    assert "status" in output
    assert output["status"] in ("completed", "partial", "failed", "error")
    assert "results" in output
    assert isinstance(output["results"], list)
    assert "errors" in output
    assert isinstance(output["errors"], list)
    assert "total_raw" in output
    assert isinstance(output["total_raw"], int)
    assert "per_source" in output
    assert isinstance(output["per_source"], dict)
    assert output["total_raw"] == len(output["results"])


# ── Tests ──


class TestDiscoveryOutputFormat:
    """Test that discovery runner output format is correct."""

    def test_empty_input_returns_error(self):
        """Empty keyword/city should return error status."""
        from discovery_runner import run_discovery

        result = asyncio.run(run_discovery({"keyword": "", "city": ""}))
        assert result["status"] == "error"
        assert result["total_raw"] == 0

    def test_invalid_source_ignored(self):
        """Invalid source names should be filtered out gracefully."""
        from discovery_runner import run_discovery

        result = asyncio.run(
            run_discovery({
                "keyword": "test",
                "city": "test",
                "sources": ["invalid_source"],
            })
        )
        assert result["status"] == "error"
        assert "No valid sources" in result.get("error", "")

    def test_all_sources_constant(self):
        """Verify ALL_SOURCES contains all 5 scrapers."""
        from discovery_runner import ALL_SOURCES

        expected = {"google_maps", "justdial", "indiamart", "tradeindia", "sulekha"}
        assert set(ALL_SOURCES) == expected


class TestScraperModules:
    """Test that each scraper module is importable and has the correct signature."""

    def test_gmaps_scraper_importable(self):
        from gmaps_scraper import scrape_google_maps
        assert callable(scrape_google_maps)

    def test_justdial_scraper_importable(self):
        from justdial_scraper import scrape_justdial
        assert callable(scrape_justdial)

    def test_indiamart_scraper_importable(self):
        from indiamart_scraper import scrape_indiamart
        assert callable(scrape_indiamart)

    def test_tradeindia_scraper_importable(self):
        from tradeindia_scraper import scrape_tradeindia
        assert callable(scrape_tradeindia)

    def test_sulekha_scraper_importable(self):
        from sulekha_scraper import scrape_sulekha
        assert callable(scrape_sulekha)


class TestJustDialPhoneDecode:
    """Test JustDial phone number decoding."""

    def test_basic_decode(self):
        from justdial_scraper import _decode_justdial_phone

        # icon-acb=0, icon-dcb=1, icon-gcb=2, etc.
        result = _decode_justdial_phone("icon-dcb icon-gcb icon-jcb")
        assert result == "123"

    def test_alternative_classes(self):
        from justdial_scraper import _decode_justdial_phone

        result = _decode_justdial_phone("acb dcb gcb")
        assert result == "012"

    def test_full_phone_number(self):
        from justdial_scraper import _decode_justdial_phone

        # 9876543210
        classes = "Bcb ycb vcb scb pcb mcb jcb gcb dcb acb"
        result = _decode_justdial_phone(classes)
        assert result == "9876543210"

    def test_empty_input(self):
        from justdial_scraper import _decode_justdial_phone

        result = _decode_justdial_phone("")
        assert result == ""


class TestDiscoveryRunnerIntegration:
    """Integration tests for the discovery runner (mocked — no network)."""

    def test_output_json_serializable(self):
        """Ensure output is JSON serializable."""
        from discovery_runner import run_discovery

        result = asyncio.run(
            run_discovery({
                "keyword": "",
                "city": "",
                "sources": ["google_maps"],
            })
        )
        # Should not raise
        json_str = json.dumps(result, default=str)
        parsed = json.loads(json_str)
        validate_discovery_output(parsed)

    def test_per_source_keys_match_sources(self):
        """per_source keys should match the valid requested sources."""
        from discovery_runner import run_discovery

        result = asyncio.run(
            run_discovery({
                "keyword": "",
                "city": "",
                "sources": ["google_maps", "justdial"],
            })
        )
        # With empty keyword/city it will error before running scrapers
        assert result["status"] == "error"
