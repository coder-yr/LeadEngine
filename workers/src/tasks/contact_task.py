from typing import Any, Dict
import logging
from tasks.base_task import PythonTask
from free_contact_discovery_v3 import crawl_and_extract, GLOBAL_METRICS

logger = logging.getLogger(__name__)

class ContactTask(PythonTask):
    version = "3.1"
    
    async def perform_task(self, job_data: Dict[str, Any], job: Any) -> Dict[str, Any]:
        company_name = job_data.get("company_name")
        website_url = job_data.get("website_url")
        quick = job_data.get("quick", False)
        
        if not website_url:
            raise ValueError("website_url is required for ContactTask")
            
        logger.info(f"Executing ContactTask for '{company_name}' at '{website_url}'")
        
        if job:
            await job.updateProgress(10)
            
        if not website_url.startswith('http://') and not website_url.startswith('https://'):
            website_url = 'https://' + website_url
            
        budget = 15.0 if quick else 60.0
        
        # Reset GLOBAL_METRICS if this worker persists state
        for k in GLOBAL_METRICS.keys():
            if isinstance(GLOBAL_METRICS[k], int):
                GLOBAL_METRICS[k] = 0
            elif isinstance(GLOBAL_METRICS[k], bool):
                GLOBAL_METRICS[k] = False
                
        # This is a synchronous function, so we might want to run it in a thread pool in the future,
        # but for now we just call it directly.
        extraction_result = crawl_and_extract(website_url, time_budget=budget)
        
        if job:
            await job.updateProgress(90)
            
        return {
            "results": extraction_result.get("contacts", []),
            "evidence": [
                {
                    "businessContacts": extraction_result.get("businessContacts", []),
                    "socialProfiles": extraction_result.get("socialProfiles", []),
                    "contactPages": extraction_result.get("contactPages", [])
                }
            ],
            "metrics": {
                **extraction_result.get("fallback_metrics", {}),
                **GLOBAL_METRICS
            },
            "confidence": 85 if extraction_result.get("contacts") else 0
        }
