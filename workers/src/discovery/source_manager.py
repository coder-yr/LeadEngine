"""
source_manager.py — DiscoverySourceManager: orchestrates all source adapters.

Execution model:
  - Tier 1: Parallel, no timeout gate (highest reliability)
  - Tier 2: Parallel, 30s timeout per source
  - Tier 3: Parallel, 10s timeout per source, failures silently skipped

All source failures are caught — the pipeline NEVER stops due to one source.
Results are merged and cross-source de-duplicated by phone/domain.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord
from discovery.plugin_loader import PluginLoader
from discovery.reliability_engine import SourceReliabilityEngine
from discovery.telemetry import DiscoveryTelemetry, DiscoveryConfidence, SourceTelemetry

logger = logging.getLogger(__name__)

TIER_TIMEOUTS = {1: None, 2: 30, 3: 10}
TIER_MAX_RESULTS = {1: 100, 2: 50, 3: 30}


def _normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    import re
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else None


def _normalize_domain(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        u = url if url.startswith("http") else "https://" + url
        d = urlparse(u).netloc.lower().lstrip("www.")
        return d or None
    except Exception:
        return None


def _normalize_name(name: str) -> str:
    """Normalize business name for fuzzy matching."""
    if not name:
        return ""
    import re
    # Remove common suffixes and punctuation
    clean = re.sub(r"(?i)\b(pvt|ltd|llc|inc|private|limited|clinic|hospital)\b", "", name)
    clean = re.sub(r"[^\w\s]", "", clean).lower().strip()
    return " ".join(clean.split())


class DiscoverySourceManager:
    """
    Central orchestrator for all discovery source plugins.
    Auto-loads sources via PluginLoader — no manual registration.
    """

    def __init__(self):
        self.loader = PluginLoader()
        self.sources: List[BaseDiscoverySource] = self.loader.load_all()
        self.reliability = SourceReliabilityEngine()
        logger.info(f"[SourceManager] Initialized with {len(self.sources)} sources")

    def get_sources(self, requested: Optional[List[str]] = None) -> List[BaseDiscoverySource]:
        """
        Filter sources by name if requested. Otherwise return all.
        Always returns sources sorted by tier.
        """
        if not requested:
            return self.sources
        requested_set = set(requested)
        return [s for s in self.sources if s.name in requested_set]

    async def run(
        self,
        keyword: str,
        city: str,
        max_results: Optional[int] = None,
        requested_sources: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Execute all (or requested) sources and return merged results.

        Returns:
            {
                status: "completed" | "partial" | "failed",
                results: [...],
                errors: [...],
                total_raw: int,
                per_source: {source: count},
                telemetry: {...},
                source_reliability: {source: score},
            }
        """
        start_time = time.time()
        telemetry = DiscoveryTelemetry(keyword=keyword, city=city)
        sources = self.get_sources(requested_sources)

        # Group by tier
        by_tier: Dict[int, List[BaseDiscoverySource]] = {1: [], 2: [], 3: [], 4: []}
        
        # Always include adaptive tier 4 sources (like gemini) regardless of UI selection
        adaptive_sources = [s for s in self.sources if s.tier == 4]
        for src in adaptive_sources:
            if src not in sources:
                sources.append(src)
                
        for src in sources:
            by_tier.setdefault(src.tier, []).append(src)

        all_results: List[DiscoveryRecord] = []
        all_errors: List[Dict] = []
        per_source: Dict[str, int] = {}

        def handle_outputs(outputs):
            for tier_results, tier_errors in outputs:
                for source_name, records, error, duration in tier_results:
                    contacts = sum(1 for r in records if r.phone)
                    websites = sum(1 for r in records if r.website)

                    blocked = error is not None and (
                        "block" in (error or "").lower()
                        or "captcha" in (error or "").lower()
                        or "403" in (error or "")
                        or "429" in (error or "")
                    )

                    self.reliability.record_run(
                        source=source_name,
                        duration_sec=duration,
                        results_count=len(records),
                        contacts_count=contacts,
                        websites_count=websites,
                        duplicate_count=0,
                        error=error,
                        blocked=blocked,
                    )

                    per_source[source_name] = len(records)
                    all_results.extend(records)

                    st = SourceTelemetry(
                        source=source_name,
                        tier=next((s.tier for s in self.sources if s.name == source_name), 3),
                        duration_sec=round(duration, 2),
                        results_count=len(records),
                        contacts_found=contacts,
                        websites_found=websites,
                        duplicate_count=0,
                        success=(error is None and len(records) > 0),
                        blocked=blocked,
                        error=error,
                    )
                    telemetry.add_source(st)
                all_errors.extend(tier_errors)

        # Execute Tier 1 and 2 concurrently
        tier_tasks = []
        for tier in [1, 2]:
            tier_sources = by_tier.get(tier, [])
            if not tier_sources:
                continue

            tier_max = (max_results or TIER_MAX_RESULTS[tier])
            timeout = TIER_TIMEOUTS[tier]

            tier_tasks.append(self._run_tier(
                tier_sources, keyword, city, tier_max, timeout
            ))

        if tier_tasks:
            t1_t2_outputs = await asyncio.gather(*tier_tasks)
            handle_outputs(t1_t2_outputs)

        # Cross-source deduplication on current results to check if we have websites
        unique_so_far, _ = self._dedup(all_results)
        website_found = any(r.website for r in unique_so_far)
        
        target_count = max_results or TIER_MAX_RESULTS[1]
        needs_more = len(unique_so_far) < target_count

        # Run Tier 3 IF:
        # 1. No website was found (fallback mode)
        # 2. User explicitly selected sourcesl
        # 3. We haven't reached the requested max_results yet
        run_tier_3 = (not website_found) or (requested_sources is not None) or needs_more
        
        if run_tier_3:
            tier3_sources = by_tier.get(3, [])
            if tier3_sources:
                logger.info(f"[SourceManager] Executing Tier 3 sources (website_found={website_found}, explicit={requested_sources is not None}, needs_more={needs_more}).")
                tier_max = (max_results or TIER_MAX_RESULTS[3])
                timeout = TIER_TIMEOUTS[3]
                t3_outputs = await asyncio.gather(
                    self._run_tier(tier3_sources, keyword, city, tier_max, timeout)
                )
                handle_outputs(t3_outputs)
                
        # Update unique results before checking adaptive conditions
        unique_results, dupe_count = self._dedup(all_results)
        
        # --- COVERAGE ANALYZER ---
        def calc_coverage(records: List[DiscoveryRecord]) -> float:
            if not records:
                return 0.0
            
            total_possible = len(records) * 6
            actual = 0
            for r in records:
                if r.website: actual += 1
                if r.phone: actual += 1
                if r.email: actual += 1
                if r.address: actual += 1
                if r.platform: actual += 1
                if getattr(r, 'quality_score', 0) >= 80: actual += 1
                
            return (actual / total_possible) * 100.0

        target_count = max_results or TIER_MAX_RESULTS[1]
        coverage_score = calc_coverage(unique_results)
        needs_more_companies = len(unique_results) < target_count
        
        if coverage_score < 80.0 or needs_more_companies:
            tier4_sources = by_tier.get(4, [])
            if tier4_sources:
                logger.info(f"[SourceManager] Coverage Analyzer triggered. Score: {coverage_score:.1f}%, Target reached: {not needs_more_companies}")
                discovered_companies = [r.business_name for r in unique_results]
                
                t4_outputs = await asyncio.gather(
                    self._run_tier(
                        tier4_sources, keyword, city, target_count, 120, 
                        discovered_companies=discovered_companies,
                        coverage_score=coverage_score
                    )
                )
                handle_outputs(t4_outputs)

        # Cross-source deduplication
        unique_results, dupe_count = self._dedup(all_results)

        telemetry.total_duration_sec = round(time.time() - start_time, 2)
        telemetry.total_after_dedup = len(unique_results)

        # Build discovery confidence for each result
        discovery_confidence = DiscoveryConfidence(
            phone_found=any(r.phone for r in unique_results),
            website_exists=any(r.website for r in unique_results),
            email_found=any(r.email for r in unique_results),
            multi_source_confirmed=(len([s for s, c in per_source.items() if c > 0]) > 1),
            social_found=any(r.platform for r in unique_results),
        )

        status = "completed"
        if not unique_results:
            status = "failed"
        elif all_errors:
            status = "partial"

        result = {
            "status": status,
            "results": [r.to_legacy_dict() for r in unique_results],
            "errors": all_errors,
            "total_raw": len(all_results),
            "per_source": per_source,
            "telemetry": telemetry.to_dict(),
            "source_reliability": self.reliability.get_all_stats(),
            "discovery_confidence": discovery_confidence.to_dict(),
        }

        self.reliability.print_summary_table()
        return result

    async def _run_tier(
        self,
        sources: List[BaseDiscoverySource],
        keyword: str,
        city: str,
        max_results: int,
        timeout_sec: Optional[int],
        **kwargs
    ):
        """Run all sources in a tier concurrently."""
        results = []
        errors = []

        async def run_one(src: BaseDiscoverySource, index: int):
            # Stagger tier-3 sources so they don't hit fallbacks concurrently
            if src.tier == 3 and index > 0:
                stagger_delay = index * 2.0
                logger.info(f"[SourceManager] Staggering {src.name} by {stagger_delay}s")
                await asyncio.sleep(stagger_delay)

            start = time.time()
            try:
                if timeout_sec:
                    records = await asyncio.wait_for(
                        src.safe_search(keyword, city, max_results, **kwargs),
                        timeout=timeout_sec,
                    )
                else:
                    records = await src.safe_search(keyword, city, max_results, **kwargs)
                duration = time.time() - start
                return src.name, records, None, duration
            except asyncio.TimeoutError:
                duration = time.time() - start
                err = f"Timeout after {timeout_sec}s"
                logger.warning(f"[SourceManager] {src.name} timed out ({timeout_sec}s)")
                errors.append({"source": src.name, "error": err})
                return src.name, [], err, duration
            except Exception as exc:
                duration = time.time() - start
                err = str(exc)
                logger.error(f"[SourceManager] {src.name} failed: {exc}")
                errors.append({"source": src.name, "error": err})
                return src.name, [], err, duration

        tasks = [run_one(src, idx) for idx, src in enumerate(sources)]
        tier_results = await asyncio.gather(*tasks, return_exceptions=False)
        return list(tier_results), errors

    def _dedup(
        self,
        records: List[DiscoveryRecord],
    ) -> tuple:
        """
        Cross-source dedup by phone, domain, and normalized name.
        Enriches the kept record with data from the duplicate.
        Returns (unique_records, dupe_count).
        """
        seen_phones: Dict[str, DiscoveryRecord] = {}
        seen_domains: Dict[str, DiscoveryRecord] = {}
        seen_names: Dict[str, DiscoveryRecord] = {}
        unique: List[DiscoveryRecord] = []
        dupes = 0

        for r in records:
            phone = _normalize_phone(r.phone)
            domain = _normalize_domain(r.website)
            name = _normalize_name(r.business_name)

            is_dupe = False
            kept_record = None

            if phone and phone in seen_phones:
                is_dupe = True
                kept_record = seen_phones[phone]
            elif domain and domain in seen_domains:
                is_dupe = True
                kept_record = seen_domains[domain]
            elif name and name in seen_names:
                is_dupe = True
                kept_record = seen_names[name]

            if is_dupe and kept_record:
                dupes += 1
                # Cross-source enrichment
                if not kept_record.phone and r.phone:
                    kept_record.phone = r.phone
                if not kept_record.website and r.website:
                    kept_record.website = r.website
                if not kept_record.address and r.address:
                    kept_record.address = r.address
                if not kept_record.email and r.email:
                    kept_record.email = r.email
                # Boost quality score slightly for multi-source confirmation
                kept_record.quality_score = min(100, kept_record.quality_score + 5)
                continue

            unique.append(r)
            if phone:
                seen_phones[phone] = r
            if domain:
                seen_domains[domain] = r
            if name:
                seen_names[name] = r

        logger.info(
            f"[SourceManager] Dedup: {len(records)} → {len(unique)} "
            f"({dupes} duplicates removed and merged)"
        )
        return unique, dupes
