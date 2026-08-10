import asyncio
from bullmq import Worker

async def process_job(job, token):
    print(f"Python received job {job.id} with data {job.data}")
    return {"status": "ok"}

async def main():
    worker = Worker("test.queue", process_job, {"connection": {"host": "localhost", "port": 6379}})
    print("Python worker listening on test.queue...")
    
    # Wait for a bit to process
    await asyncio.sleep(5)
    await worker.close()

if __name__ == "__main__":
    asyncio.run(main())
