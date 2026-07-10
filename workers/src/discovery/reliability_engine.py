"""
reliability_engine.py — Source Reliability Engine.

Tracks per-source runtime statistics and computes a live reliability score (0-100).
Stats are persisted to PostgreSQL (source_reliability table) via Supabase REST.
Falls back gracefully if DB is unavailable.

Reliability Score Formula:
  success_rate  × 40    (% runs that returned any results)
  avg_contacts  × 20    (contacts per run, normalized 0-5 = max)
  avg_websites  × 20    (websites per run, normalized 0-5 = max)
  - duplicate_rate × 20 (% results flagged as duplicate)
  - blocked_rate  × 20  (% runs that were blocked)
  Clamped to 0-100.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


@dataclass
class SourceStats:
    source_name: str
    total_runs: int = 0
    successful_runs: int = 0
    failed_runs: int = 0
    blocked_runs: int = 0
    total_results: int = 0
    total_contacts: int = 0
    total_websites: int = 0
    total_runtime_sec: float = 0.0
    duplicate_count: int = 0
    reliability_score: float = 50.0
    last_success_at: Optional[str] = None
    last_failure_at: Optional[str] = None

    @property
    def success_rate(self) -> float:
        if self.total_runs == 0:
            return 0.5
        return self.successful_runs / self.total_runs

    @property
    def blocked_rate(self) -> float:
        if self.total_runs == 0:
            return 0.0
        return self.blocked_runs / self.total_runs

    @property
    def duplicate_rate(self) -> float:
        if self.total_results == 0:
            return 0.0
        return self.duplicate_count / self.total_results

    @property
    def avg_contacts_per_run(self) -> float:
        if self.successful_runs == 0:
            return 0.0
        return self.total_contacts / self.successful_runs

    @property
    def avg_websites_per_run(self) -> float:
        if self.successful_runs == 0:
            return 0.0
        return self.total_websites / self.successful_runs

    @property
    def avg_runtime_sec(self) -> float:
        if self.total_runs == 0:
            return 0.0
        return self.total_runtime_sec / self.total_runs


def _compute_score(stats: SourceStats) -> float:
    """
    Compute reliability score 0-100.
    Higher = more reliable.
    """
    # Positive signals
    success_component = stats.success_rate * 40.0

    # avg_contacts: 5+ contacts per run = max 20 pts
    contacts_norm = min(1.0, stats.avg_contacts_per_run / 5.0)
    contacts_component = contacts_norm * 20.0

    # avg_websites: 5+ websites per run = max 20 pts
    websites_norm = min(1.0, stats.avg_websites_per_run / 5.0)
    websites_component = websites_norm * 20.0

    # Negative penalties
    duplicate_penalty = stats.duplicate_rate * 20.0
    blocked_penalty = stats.blocked_rate * 20.0

    raw = (
        success_component
        + contacts_component
        + websites_component
        - duplicate_penalty
        - blocked_penalty
    )
    return round(max(0.0, min(100.0, raw)), 2)


class SourceReliabilityEngine:
    """
    Records per-run stats and persists reliability scores to Supabase.
    All operations are fire-and-forget — never block the discovery pipeline.
    """

    def __init__(self):
        self._local_stats: Dict[str, SourceStats] = {}

    def record_run(
        self,
        source: str,
        duration_sec: float,
        results_count: int,
        contacts_count: int,
        websites_count: int,
        duplicate_count: int,
        error: Optional[str] = None,
        blocked: bool = False,
    ) -> None:
        """Record the outcome of one source run and persist to DB."""
        stats = self._local_stats.setdefault(source, SourceStats(source_name=source))

        stats.total_runs += 1
        stats.total_runtime_sec += duration_sec
        stats.total_results += results_count
        stats.total_contacts += contacts_count
        stats.total_websites += websites_count
        stats.duplicate_count += duplicate_count

        now_iso = datetime.utcnow().isoformat() + "Z"

        if error is None and not blocked and results_count > 0:
            stats.successful_runs += 1
            stats.last_success_at = now_iso
        else:
            stats.failed_runs += 1
            stats.last_failure_at = now_iso

        if blocked:
            stats.blocked_runs += 1

        stats.reliability_score = _compute_score(stats)

        # Persist asynchronously (fire-and-forget)
        self._persist(source, stats, now_iso)

    def get_reliability(self, source: str) -> float:
        """Return the current reliability score for a source (default 50)."""
        stats = self._local_stats.get(source)
        return stats.reliability_score if stats else 50.0

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Return all stats as plain dicts (for telemetry output)."""
        return {
            name: {
                **asdict(stats),
                "success_rate": stats.success_rate,
                "blocked_rate": stats.blocked_rate,
                "duplicate_rate": stats.duplicate_rate,
                "avg_contacts_per_run": stats.avg_contacts_per_run,
                "avg_websites_per_run": stats.avg_websites_per_run,
                "avg_runtime_sec": stats.avg_runtime_sec,
            }
            for name, stats in self._local_stats.items()
        }

    def _persist(self, source: str, stats: SourceStats, now_iso: str) -> None:
        """
        Upsert stats to source_reliability table via Supabase REST.
        Silently fails if Supabase is unavailable.
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return
        try:
            payload = {
                "source_name": source,
                "total_runs": stats.total_runs,
                "successful_runs": stats.successful_runs,
                "failed_runs": stats.failed_runs,
                "blocked_runs": stats.blocked_runs,
                "total_results": stats.total_results,
                "total_contacts": stats.total_contacts,
                "total_websites": stats.total_websites,
                "total_runtime_sec": round(stats.total_runtime_sec, 3),
                "duplicate_count": stats.duplicate_count,
                "reliability_score": stats.reliability_score,
                "last_success_at": stats.last_success_at,
                "last_failure_at": stats.last_failure_at,
                "updated_at": now_iso,
            }
            headers = {
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            }
            requests.post(
                f"{SUPABASE_URL}/rest/v1/source_reliability",
                json=payload,
                headers=headers,
                timeout=3,
            )
        except Exception as exc:
            logger.debug(f"[ReliabilityEngine] Failed to persist stats for {source}: {exc}")
