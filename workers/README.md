# Workers README

## Overview

Python async workers for LeadEngine - handles crawling, extraction, and processing tasks.

## Tech Stack

- **Runtime:** Python 3.11
- **Task Queue:** Crawl4AI, Scrapy
- **Web Scraping:** Playwright, BeautifulSoup4
- **Async:** asyncio, httpx
- **Database:** Supabase
- **Cache:** Redis
- **Validation:** Pydantic

## Structure

```
src/
├── worker.py            # Entry point
├── tasks/
│   ├── crawl.py         # Website crawling tasks
│   ├── extract.py       # Data extraction tasks
│   ├── score.py         # Lead scoring tasks
│   └── verify.py        # Verification tasks
├── services/
│   ├── crawl_service.py
│   ├── extraction_service.py
│   ├── scoring_service.py
│   └── llm_service.py
├── utils/
│   ├── redis_client.py
│   ├── supabase_client.py
│   ├── logger.py
│   └── validators.py
└── types/
    └── models.py
```

## Getting Started

### Create Virtual Environment

```bash
python -m venv venv

# Activate
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values.

### Run Worker

```bash
python -m src.worker
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REDIS_HOST` | Redis host | ✓ |
| `REDIS_PORT` | Redis port | ✓ |
| `SUPABASE_URL` | Supabase project URL | ✓ |
| `SUPABASE_SERVICE_KEY` | Service key | ✓ |
| `WORKER_CONCURRENCY` | Number of concurrent tasks | ✓ |
| `OLLAMA_BASE_URL` | Ollama API URL | ✗ |

## Tasks

### Crawl Task

Crawls website and extracts content.

```python
from src.tasks.crawl import crawl_website

result = await crawl_website(url="https://example.com")
```

### Extract Task

Extracts structured data from content.

```python
from src.tasks.extract import extract_data

data = await extract_data(content=html_content)
```

### Score Task

Scores lead quality.

```python
from src.tasks.score import score_lead

score = await score_lead(lead_data=company_data)
```

### Verify Task

Verifies contact information.

```python
from src.tasks.verify import verify_contact

result = await verify_contact(phone="+1234567890")
```

## Testing

```bash
pytest
pytest -v
pytest --cov
```

## Development

### Install Development Dependencies

```bash
pip install -r requirements-dev.txt
```

### Run with Debug Logging

```bash
LOG_LEVEL=DEBUG python -m src.worker
```

### Type Checking

```bash
mypy src/
```

## Deployment

### Docker

```bash
docker build -t leadengine-workers .
docker run --env-file .env leadengine-workers
```

### VPS with PM2

```bash
# Install PM2
npm install -g pm2

# Create ecosystem.config.js
pm2 start "python -m src.worker" --name leadengine-worker

# Monitor
pm2 monit

# Logs
pm2 logs leadengine-worker
```

## Scaling

For multiple workers:

```bash
python -m src.worker --id worker-1
python -m src.worker --id worker-2
python -m src.worker --id worker-3
```

Or use Docker Compose with service replicas:

```bash
docker-compose up -d --scale workers=3
```

---

**Status:** Phase 0 - Bootstrap ✅
