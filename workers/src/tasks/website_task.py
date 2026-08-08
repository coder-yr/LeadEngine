from typing import Any, Dict
import logging
from tasks.base_task import PythonTask
from intelligence.website_intelligence_v2 import WebsiteIntelligencePipelineV2

logger = logging.getLogger(__name__)

class WebsiteTask(PythonTask):
    version = "2.0"
    
    async def perform_task(self, job_data: Dict[str, Any], job: Any) -> Dict[str, Any]:
        url = job_data.get("url")
        if not url:
            raise ValueError("URL is required for WebsiteTask")
            
        logger.info(f"Executing WebsiteTask for '{url}'")
        
        if job:
            await job.updateProgress(10)
            
        pipeline = WebsiteIntelligencePipelineV2(max_pages=5)
        doc = await pipeline.run(url)
        
        if job:
            await job.updateProgress(90)
            
        if doc.fetch_status != 200:
            logger.warning(f"Website fetch returned status {doc.fetch_status}")
            
        return {
            "results": [
                {
                    "document": doc.to_provenance_dict(),
                    "legacy": doc.to_legacy_dict()
                }
            ],
            "confidence": 100 if doc.fetch_status == 200 else 0,
            "metrics": {
                "fetch_status": doc.fetch_status
            }
        }
