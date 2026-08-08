from typing import Any, Dict
import logging
from tasks.base_task import PythonTask
from discovery_runner import run

logger = logging.getLogger(__name__)

class DiscoveryTask(PythonTask):
    version = "2.1"
    
    async def perform_task(self, job_data: Dict[str, Any], job: Any) -> Dict[str, Any]:
        keyword = job_data.get("keyword")
        city = job_data.get("city")
        logger.info(f"Executing DiscoveryTask for '{keyword}' in '{city}'")
        
        if job:
            await job.updateProgress(10)
            
        # Run the actual business logic without subprocess
        runner_output = await run(job_data)
        
        if job:
            await job.updateProgress(90)
            
        if runner_output.get("status") == "error":
            raise Exception(runner_output.get("error", "Unknown error in discovery_runner"))
            
        # Return dict matching Evidence Engine expectations
        # The base_task will wrap this in {"status": "success", "results": [...], ...}
        return {
            "results": runner_output.get("results", []),
            "metrics": {
                "total_raw": runner_output.get("total_raw", 0),
                "per_source": runner_output.get("per_source", {})
            },
            "confidence": 90 # baseline
        }
