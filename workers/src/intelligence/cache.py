"""
cache.py — Domain-level Redis cache for intelligence pipeline components.

Cache keys: le:{component}:{domain}
TTLs:
  html             → 24h
  website_document → 24h
  contacts         → 24h
  audit            → 24h
  ner              → 7d
  classification   → 7d

Falls back gracefully if Redis is unavailable (cache miss = run fresh).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

COMPONENT_TTL = {
    "html":              86_400,    # 24 hours
    "website_document":  86_400,    # 24 hours
    "contacts":          86_400,    # 24 hours
    "audit":             86_400,    # 24 hours
    "ner":               604_800,   # 7 days
    "classification":    604_800,   # 7 days
}

_redis_client = None


def _get_redis():
    """Lazy Redis connection — returns None if unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore

        host = os.getenv("REDIS_HOST", "localhost")
        port = int(os.getenv("REDIS_PORT", "6379"))
        password = os.getenv("REDIS_PASSWORD", None)
        _redis_client = redis.Redis(
            host=host,
            port=port,
            password=password,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        _redis_client.ping()  # Validate connection
        logger.info(f"[Cache] Redis connected at {host}:{port}")
        return _redis_client
    except Exception as exc:
        logger.warning(f"[Cache] Redis unavailable — running without cache: {exc}")
        _redis_client = None
        return None


def _make_key(component: str, domain: str) -> str:
    """Generate cache key. Strip www and normalize."""
    clean = domain.lower().strip().lstrip("www.").rstrip("/")
    return f"le:{component}:{clean}"


class IntelligenceCache:
    """
    Per-component domain cache backed by Redis.
    All methods are fail-safe — cache misses never break the pipeline.
    """

    def get(self, component: str, domain: str) -> Optional[Any]:
        """
        Retrieve a cached value. Returns None on miss or Redis error.
        Value is deserialized from JSON.
        """
        r = _get_redis()
        if r is None:
            return None
        try:
            key = _make_key(component, domain)
            raw = r.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.debug(f"[Cache] get failed for {component}:{domain}: {exc}")
            return None

    def set(self, component: str, domain: str, value: Any) -> None:
        """
        Store a value with the appropriate TTL.
        Value is serialized to JSON.
        """
        r = _get_redis()
        if r is None:
            return
        try:
            key = _make_key(component, domain)
            ttl = COMPONENT_TTL.get(component, 86_400)
            r.setex(key, ttl, json.dumps(value, default=str))
        except Exception as exc:
            logger.debug(f"[Cache] set failed for {component}:{domain}: {exc}")

    def invalidate(self, domain: str) -> None:
        """Invalidate ALL cached components for a domain."""
        r = _get_redis()
        if r is None:
            return
        try:
            clean = domain.lower().strip().lstrip("www.")
            pattern = f"le:*:{clean}"
            keys = r.keys(pattern)
            if keys:
                r.delete(*keys)
                logger.info(f"[Cache] Invalidated {len(keys)} keys for {domain}")
        except Exception as exc:
            logger.debug(f"[Cache] invalidate failed for {domain}: {exc}")

    def invalidate_component(self, component: str, domain: str) -> None:
        """Invalidate a specific component for a domain."""
        r = _get_redis()
        if r is None:
            return
        try:
            key = _make_key(component, domain)
            r.delete(key)
        except Exception as exc:
            logger.debug(f"[Cache] invalidate_component failed for {component}:{domain}: {exc}")

    def exists(self, component: str, domain: str) -> bool:
        """Check if a cache entry exists."""
        r = _get_redis()
        if r is None:
            return False
        try:
            key = _make_key(component, domain)
            return bool(r.exists(key))
        except Exception:
            return False

    def ttl(self, component: str, domain: str) -> int:
        """Return remaining TTL in seconds (-1 if not found)."""
        r = _get_redis()
        if r is None:
            return -1
        try:
            key = _make_key(component, domain)
            return r.ttl(key)
        except Exception:
            return -1


# Module-level singleton
cache = IntelligenceCache()
