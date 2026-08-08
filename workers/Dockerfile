FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY workers/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install browser dependencies for crawl4ai
RUN playwright install --with-deps chromium

# Copy source code
COPY workers/ .

# Run worker
CMD ["python", "-m", "src.worker"]
