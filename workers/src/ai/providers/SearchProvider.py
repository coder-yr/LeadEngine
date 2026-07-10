from abc import ABC, abstractmethod
import hashlib
from typing import List, Dict, Any, Optional
import time

from discovery.base_source import DiscoveryRecord

class SearchProvider(ABC):
    """
    Abstract Base Class for all AI and fallback Search Providers.
    """
    
    name: str = "base_provider"
    supports_live_search: bool = False
    
    @abstractmethod
    async def search(
        self,
        keyword: str,
        city: str,
        target_results: int,
        discovered_companies: List[str] = None,
        timeout_sec: Optional[int] = None
    ) -> List[DiscoveryRecord]:
        """
        Executes a search to find companies based on the keyword and city.
        
        Args:
            keyword: The search query intent (e.g. 'Dentist').
            city: The target location (e.g. 'Mumbai').
            target_results: How many results to return.
            discovered_companies: List of already known company names to exclude.
            timeout_sec: Maximum time allowed for this provider to execute.
            
        Returns:
            A list of validated DiscoveryRecord objects.
        """
        pass
        
    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        """
        Returns the health status of the provider.
        Should verify API keys, connectivity, and quota (if possible).
        
        Returns:
            Dict containing {'status': 'healthy'|'unhealthy', 'reason': str}
        """
        pass

    def _get_cache_key(self, query: str) -> str:
        """
        Generates a standard cache key for Redis.
        """
        q_hash = hashlib.md5(query.encode('utf-8')).hexdigest()
        return f"ai:search:{self.name}:v1:{q_hash}"
