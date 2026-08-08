import asyncio
import logging
import os
import traceback
from typing import Dict
from bullmq import Worker, Queue, Job

from tasks.base_task import PythonTask
from tasks.discovery_task import DiscoveryTask
from tasks.website_task import WebsiteTask
from tasks.contact_task import ContactTask

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
logger = logging.getLogger("worker")

import urllib.parse

REDIS_URL = os.environ.get("REDIS_URL")
if REDIS_URL:
    # Pass the raw URL directly to let redis-py handle all parsing
    # (including passwords, ssl, and db indexes) perfectly!
    redis_opts = REDIS_URL
    
    # Just for logging purposes
    url = urllib.parse.urlparse(REDIS_URL)
    REDIS_HOST = url.hostname
    REDIS_PORT = url.port or 6379
else:
    REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
    REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
    REDIS_USERNAME = os.environ.get("REDIS_USERNAME", "")
    REDIS_SSL = os.environ.get("REDIS_SSL", "false").lower() == "true"

    redis_opts = {
        "host": REDIS_HOST,
        "port": REDIS_PORT,
        "password": REDIS_PASSWORD
    }
    if REDIS_USERNAME:
        redis_opts["username"] = REDIS_USERNAME
    if REDIS_SSL:
        redis_opts["ssl"] = True
        import ssl
        redis_opts["ssl_cert_reqs"] = ssl.CERT_NONE

# Task Registry
TASKS: Dict[str, PythonTask] = {
    "discovery.execute.queue": DiscoveryTask(),
    "website.execute.queue": WebsiteTask(),
    "contact.execute.queue": ContactTask(),
}

async def process_job(job: Job, job_token: str):
    """
    Generic job processor that delegates to the appropriate Task handler based on the queue name.
    """
    # In Python bullmq, queue_name isn't an attribute, but job.queue is the Queue/Worker object
    queue_name = getattr(job, "queue_name", getattr(job.queue, "name", None))
    if not queue_name:
        queue_name = job.queueQualifiedName.replace("bull:", "") if getattr(job, "queueQualifiedName", None) else "unknown"
        
    handler = TASKS.get(queue_name)
    
    if not handler:
        logger.error(f"No handler registered for queue {queue_name}")
        raise ValueError(f"No handler registered for queue {queue_name}")
        
    logger.info(f"Processing job {job.id} from {queue_name}")
    
    try:
        # 1. Execute task
        result = await handler.execute(job.data, job)
        
        # 2. Enqueue to completion queue (handled by Node orchestrator)
        completed_queue_name = queue_name.replace(".execute.queue", ".completed.queue")
        
        # Push correlation IDs downstream
        payload = {
            "pipelineId": job.data.get("pipelineId"),
            "companyId": job.data.get("companyId"),
            "traceId": job.data.get("traceId"),
            "jobId": job.data.get("jobId"),
            "payload": result
        }
        
        logger.info(f"Task {queue_name} completed. Enqueueing to {completed_queue_name}")
        completed_queue = Queue(completed_queue_name, {"connection": redis_opts})
        await completed_queue.add("completed", payload)
        await completed_queue.close()
        
        return result
        
    except Exception as e:
        logger.error(f"Job {job.id} failed: {e}\n{traceback.format_exc()}")
        raise e

async def main():
    logger.info("Starting Python Workers...")
    logger.info(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}")
    
    workers = []
    
    # Create one worker per execute queue
    for queue_name in TASKS.keys():
        worker = Worker(
            queue_name,
            process_job,
            {"connection": redis_opts, "concurrency": 2}
        )
        workers.append(worker)
        logger.info(f"Listening on {queue_name}")
        
    # Keep alive
    try:
        await asyncio.Event().wait()
    except asyncio.exceptions.CancelledError:
        pass
    finally:
        for worker in workers:
            await worker.close()

if __name__ == "__main__":
    asyncio.run(main())
