# Setup Guide

Complete setup instructions for LeadEngine development and deployment.

## Prerequisites

### System Requirements

- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Python:** 3.11 or higher
- **Docker:** 20.10+ and Docker Compose 2.0+
- **Git:** 2.x or higher
- **RAM:** 8GB minimum (16GB recommended)

### Verify Installation

```bash
node --version    # v18.x or higher
npm --version     # 9.x or higher
python --version  # 3.11+
docker --version  # 20.10+
docker-compose --version  # 2.0+
```

## Local Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd LeadEngine
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Install Backend Dependencies

```bash
cd ../backend
npm install
```

### 4. Setup Python Worker Environment

```bash
cd ../workers

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 5. Configure Environment Variables

```bash
# Frontend
cp frontend/.env.example frontend/.env.local

# Backend
cp backend/.env.example backend/.env.local

# Workers
cp workers/.env.example workers/.env
```

**Edit each `.env` file with your actual values.**

### 6. Start Local Services (Docker)

```bash
# From project root
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f
```

**Services:**
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Ollama: localhost:11434

### 7. Run Database Migrations

```bash
cd backend
npm run db:migrate
```

### 8. Start Development Servers

**Terminal 1 - Backend:**

```bash
cd backend
npm run dev
# Server runs on http://localhost:3000
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

**Terminal 3 - Workers:**

```bash
cd workers

# Activate virtual environment (if not already active)
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Run worker
python -m src.worker
```

### 9. Verify Setup

**Frontend:** Open http://localhost:5173  
**Backend API:** Check http://localhost:3000/health  
**Database:** Connect with any PostgreSQL client

```bash
# Test backend API
curl http://localhost:3000/health
```

## Docker Setup

### Build Docker Images

```bash
docker-compose build

# Or build specific service
docker-compose build backend
docker-compose build frontend
docker-compose build workers
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Supabase Setup

### Option 1: Cloud Supabase (Recommended)

1. Go to https://supabase.com
2. Sign up / Log in
3. Create new project
4. Copy credentials:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SUPABASE_ANON_KEY`
5. Update `.env.local` files

### Option 2: Local Supabase (Docker)

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize local Supabase
supabase init

# Start local Supabase
supabase start

# Get connection details
supabase status
```

## Redis Setup

### Using Docker (Recommended)

Already included in `docker-compose.yml`

### Local Redis

**macOS:**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Windows:**

Download from: https://github.com/microsoftarchive/redis/releases

## Ollama Setup (Optional)

For local AI models:

### Installation

1. Download from https://ollama.ai
2. Run installer
3. Start Ollama service

### Pull Model

```bash
ollama pull llama2
# or
ollama pull deepseek-coder
```

### Verify

```bash
curl http://localhost:11434/api/tags
```

## IDE Setup

### VS Code

**Recommended Extensions:**

- ES7+ React/Redux/React-Native snippets
- ESLint
- Prettier - Code formatter
- Thunder Client (API testing)
- Postman (API testing)
- PostgreSQL Explorer
- Pylance (Python)

**Settings:**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.python",
    "editor.formatOnSave": true
  }
}
```

## Running Tests

### Frontend

```bash
cd frontend
npm run test
npm run test:watch
npm run test:coverage
```

### Backend

```bash
cd backend
npm run test
npm run test:watch
npm run test:coverage
```

### Workers

```bash
cd workers
pytest
pytest --cov
```

## Building for Production

### Frontend Build

```bash
cd frontend
npm run build

# Output in frontend/dist/
```

### Backend Build

```bash
cd backend
npm run build

# Output in backend/dist/
```

### Start Production Backend

```bash
cd backend
npm start
```

## Deployment

### Deploy to Vercel (Frontend)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel
```

### Deploy to Railway (Backend)

1. Create Railway account: https://railway.app
2. Connect GitHub repository
3. Select backend directory
4. Configure environment variables
5. Deploy

### Deploy Workers to VPS

```bash
# SSH into VPS
ssh user@your-vps-ip

# Clone repository
git clone <repo-url>

# Setup Python environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run worker with process manager
# Using PM2 (Node) for background management
pm2 start "python -m src.worker" --name leadengine-worker
```

## Troubleshooting

### Connection Issues

```bash
# Test database connection
psql postgresql://postgres:postgres@localhost:5432/leadengine

# Test Redis connection
redis-cli ping

# Test backend API
curl http://localhost:3000/health
```

### Docker Issues

```bash
# Remove all containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

### Port Already in Use

```bash
# Kill process on port
# macOS/Linux:
lsof -i :3000  # View process
kill -9 <PID>

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Python Environment Issues

```bash
# Remove venv and recreate
rm -rf workers/venv
python -m venv workers/venv
source workers/venv/bin/activate
pip install -r workers/requirements.txt
```

## Common Commands

```bash
# Install dependencies across all workspaces
npm install

# Run linting
npm run lint --workspaces

# Run type checking
npm run type-check --workspaces

# Run tests
npm run test --workspaces

# Build all projects
npm run build --workspaces

# Start Docker services
npm run docker:up

# Stop Docker services
npm run docker:down

# View Docker logs
npm run docker:logs
```

## Next Steps

1. ✅ Local environment setup
2. ✅ Database configured
3. ✅ Services running
4. 👉 Start Phase 1: Database Schema & API Setup

See [ARCHITECTURE.md](ARCHITECTURE.md) for system overview.

---

**Last Updated:** 2026-06-10
