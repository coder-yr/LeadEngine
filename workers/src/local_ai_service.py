import os
import time
import logging
import asyncio
from typing import Dict, Any, List, Union
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import numpy as np
from transformers import pipeline

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Local AI Service")

# Models configuration
MODELS_CONFIG = {
    "ner": {
        "model": "dslim/bert-base-NER",
        "task": "ner",
        "params": {"aggregation_strategy": "simple"}
    },
    "classification": {
        "model": "MoritzLaurer/ModernBERT-large-zeroshot-v2.0",
        "task": "zero-shot-classification"
    },
    "embedding": {
        "model": "BAAI/bge-small-en-v1.5",
        "task": "feature-extraction"
    }
}

registry = {}
device_name = "cpu"
queue = asyncio.Queue()

# Metrics tracking
metrics = {
    "startup_time_sec": 0,
    "requests_processed": 0,
    "total_inference_time_sec": 0,
    "errors": 0
}

class InferRequest(BaseModel):
    task: str
    payload: Dict[str, Any]

def sanitize_for_json(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.generic):
        return obj.item()
    elif isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(sanitize_for_json(item) for item in obj)
    return obj

async def inference_worker():
    while True:
        try:
            req_data, future = await queue.get()
            
            task_name = req_data.task
            payload = req_data.payload
            
            if task_name not in registry:
                future.set_exception(Exception(f"Task {task_name} not found in model registry."))
                queue.task_done()
                continue
                
            model_pipeline = registry[task_name]["pipeline"]
            
            def run_pipe():
                inputs = payload.get("inputs")
                params = payload.get("parameters", {})
                return model_pipeline(inputs, **params)
                    
            try:
                t0 = time.time()
                result = await asyncio.to_thread(run_pipe)
                inference_time = time.time() - t0
                
                metrics["requests_processed"] += 1
                metrics["total_inference_time_sec"] += inference_time
                
                sanitized_result = sanitize_for_json(result)
                future.set_result(sanitized_result)
            except Exception as e:
                metrics["errors"] += 1
                logger.error(f"Inference error for {task_name}: {e}")
                future.set_exception(e)
                
            queue.task_done()
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    global device_name
    startup_t0 = time.time()
    
    device = 0 if torch.cuda.is_available() else -1
    device_name = "cuda" if device == 0 else "cpu"
    logger.info(f"Hardware detected. Using device: {device_name}")
    
    for task_name, config in MODELS_CONFIG.items():
        logger.info(f"Loading model for task: {task_name}...")
        logger.info(f"Checking cache / Downloading {config['model']} (Using cached weights if available)...")
        
        t0 = time.time()
        pipe = pipeline(
            task=config["task"],
            model=config["model"],
            device=device,
            **config.get("params", {})
        )
        load_time = int((time.time() - t0) * 1000)
        
        registry[task_name] = {
            "pipeline": pipe,
            "name": config["model"],
            "loaded": True,
            "device": device_name,
            "load_time_ms": load_time
        }
        logger.info(f"Loaded {config['model']} successfully in {load_time}ms.")
        
    asyncio.create_task(inference_worker())
    
    metrics["startup_time_sec"] = time.time() - startup_t0
    logger.info(f"AI Service is ready! Total startup time: {metrics['startup_time_sec']:.2f}s")

@app.post("/infer")
async def infer(request: InferRequest):
    if request.task not in registry:
        raise HTTPException(status_code=400, detail=f"Unsupported task: {request.task}")
        
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    
    await queue.put((request, future))
    
    try:
        result = await future
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": len(registry),
        "registry": {k: {"name": v["name"], "loaded": v["loaded"], "device": v["device"]} for k, v in registry.items()}
    }

@app.get("/models")
async def get_models():
    res = []
    for t_name, data in registry.items():
        res.append({
            "task": t_name,
            "name": data["name"],
            "loaded": data["loaded"],
            "device": data["device"],
            "load_time_ms": data["load_time_ms"]
        })
    return {"models": res}

@app.get("/metrics")
async def get_metrics():
    # Attempt to get basic memory stats safely
    gpu_mem = "N/A"
    if device_name == "cuda":
        try:
            gpu_mem = f"{torch.cuda.memory_allocated() / (1024**2):.2f} MB"
        except:
            pass
            
    return {
        "requests_processed": metrics["requests_processed"],
        "errors": metrics["errors"],
        "queue_depth": queue.qsize(),
        "total_inference_time_sec": round(metrics["total_inference_time_sec"], 2),
        "startup_time_sec": round(metrics["startup_time_sec"], 2),
        "device": device_name,
        "gpu_memory": gpu_mem
    }
