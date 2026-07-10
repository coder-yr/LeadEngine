import json
import logging
import os
import time
from typing import Dict, Any, List

import redis

logger = logging.getLogger(__name__)

class SearchMemory:
    """
    Handles provider health tracking and telemetry telemetry.
    Stores historical data in Redis for analytics and dynamic provider selection.
    """
    def __init__(self):
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        redis_password = os.getenv("REDIS_PASSWORD", "")
        self.redis = redis.Redis(
            host=redis_host, port=redis_port, password=redis_password, decode_responses=True
        )

    def record_search(
        self,
        query: str,
        provider: str,
        latency: float,
        companies_found: int,
        coverage_score_before: float,
        is_success: bool = True,
        error_msg: str = ""
    ):
        """Records telemetry for a single search execution."""
        event = {
            "timestamp": time.time(),
            "query": query,
            "provider": provider,
            "latency": latency,
            "companies_found": companies_found,
            "coverage_score_before": coverage_score_before,
            "success": is_success,
            "error": error_msg
        }
        
        try:
            self.redis.lpush("ai:telemetry:searches", json.dumps(event))
            self.redis.ltrim("ai:telemetry:searches", 0, 9999) # Keep last 10,000
            
            # Update Provider Health metrics
            self._update_provider_health(provider, latency, companies_found, is_success)
        except Exception as e:
            logger.error(f"[SearchMemory] Failed to record search telemetry: {e}")

    def _update_provider_health(self, provider: str, latency: float, companies_found: int, is_success: bool):
        key = f"ai:provider_health:{provider}"
        try:
            health_data = self.redis.get(key)
            if health_data:
                health = json.loads(health_data)
            else:
                health = {
                    "total_requests": 0,
                    "successful_requests": 0,
                    "failed_requests": 0,
                    "total_latency": 0.0,
                    "total_companies": 0,
                    "last_success": 0,
                    "last_failure": 0,
                }

            health["total_requests"] += 1
            if is_success:
                health["successful_requests"] += 1
                health["total_latency"] += latency
                health["total_companies"] += companies_found
                health["last_success"] = time.time()
            else:
                health["failed_requests"] += 1
                health["last_failure"] = time.time()

            self.redis.set(key, json.dumps(health))
        except Exception as e:
            logger.error(f"[SearchMemory] Failed to update provider health: {e}")

    def get_provider_health(self, provider: str) -> Dict[str, Any]:
        """Returns health metrics for a given provider."""
        key = f"ai:provider_health:{provider}"
        try:
            data = self.redis.get(key)
            if data:
                health = json.loads(data)
                
                # Check if it failed recently (e.g., within the last 5 minutes)
                failed_recently = False
                if health["last_failure"] > health["last_success"]:
                    if (time.time() - health["last_failure"]) < 300: # 5 minutes penalty
                        failed_recently = True
                
                return {
                    "provider": provider,
                    "success_rate": health["successful_requests"] / max(1, health["total_requests"]),
                    "avg_latency": health["total_latency"] / max(1, health["successful_requests"]),
                    "avg_companies": health["total_companies"] / max(1, health["successful_requests"]),
                    "failed_recently": failed_recently,
                    "is_healthy": not failed_recently
                }
        except Exception:
            pass
            
        # Default healthy if no data
        return {
            "provider": provider,
            "success_rate": 1.0,
            "avg_latency": 0.0,
            "avg_companies": 0,
            "failed_recently": False,
            "is_healthy": True
        }
