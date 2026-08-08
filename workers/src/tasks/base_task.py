import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class PythonTask(ABC):
    """
    Base class for all Python execution tasks.
    Every task must return a structured dictionary conforming to the Evidence Engine schema.
    """
    version: str = "1.0"
    
    async def execute(self, job_data: Dict[str, Any], job: Any = None) -> Dict[str, Any]:
        """
        Execute the task and return a standardized Evidence payload.
        
        Args:
            job_data (dict): The payload from BullMQ job.data.
            job (Job, optional): The BullMQ job instance, used for progress updates.
        """
        start_time = time.time()
        
        try:
            # Concrete tasks implement perform_task
            result = await self.perform_task(job_data, job)
            
            # Ensure the result is formatted properly
            duration_ms = int((time.time() - start_time) * 1000)
            return self._format_success(result, duration_ms)
            
        except Exception as e:
            logger.exception(f"Task execution failed: {e}")
            duration_ms = int((time.time() - start_time) * 1000)
            return self._format_error(str(e), duration_ms)

    @abstractmethod
    async def perform_task(self, job_data: Dict[str, Any], job: Any) -> Dict[str, Any]:
        """
        The actual business logic of the task.
        Must return a dict containing at least 'results', 'evidence', and 'metrics'.
        """
        pass
        
    def _format_success(self, task_result: Dict[str, Any], duration_ms: int) -> Dict[str, Any]:
        """Standardizes successful responses"""
        return {
            "task": self.task_name,
            "status": "success",
            "version": self.version,
            "duration_ms": duration_ms,
            "confidence": task_result.get("confidence", 0),
            "warnings": task_result.get("warnings", []),
            "errors": [],
            "results": task_result.get("results", []),
            "evidence": task_result.get("evidence", []),
            "metrics": task_result.get("metrics", {})
        }
        
    def _format_error(self, error_message: str, duration_ms: int) -> Dict[str, Any]:
        """Standardizes error responses"""
        return {
            "task": self.task_name,
            "status": "error",
            "version": self.version,
            "duration_ms": duration_ms,
            "confidence": 0,
            "warnings": [],
            "errors": [error_message],
            "results": [],
            "evidence": [],
            "metrics": {}
        }
        
    @property
    def task_name(self) -> str:
        """Returns the name of the task, e.g. 'discovery'"""
        return self.__class__.__name__.lower().replace("task", "")
