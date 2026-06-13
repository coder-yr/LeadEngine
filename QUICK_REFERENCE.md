# Quick Reference

Common commands and configurations for LeadEngine.

## Project Commands

```bash
# Install all dependencies
npm install

# Development servers
npm run dev:frontend
npm run dev:backend
npm run dev:workers

# Building
npm run build --workspaces
npm run build:frontend
npm run build:backend

# Linting
npm run lint --workspaces

# Testing
npm run test --workspaces

# Docker
npm run docker:up
npm run docker:down
npm run docker:logs
```

## Folder Structure Quick Reference

```
LeadEngine/
├── frontend/              React + Vite + Material UI
├── backend/               Express + TypeScript
├── workers/               Python 3.11
├── docs/                  Documentation
└── docker-compose.yml     Docker services
```

## Technology Stack Reference

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Material UI |
| Backend | Node.js, Express, TypeScript |
| Database | Supabase (PostgreSQL) |
| Cache | Redis |
| Queue | BullMQ |
| Workers | Python 3.11 |
| AI | Ollama (Llama 2, DeepSeek, Qwen) |
| Deployment | Vercel, Railway, Docker |

## Environment Variables Quick Reference

### Frontend
- `VITE_API_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

### Backend
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service key for admin
- `REDIS_HOST` - Redis host
- `DATABASE_URL` - PostgreSQL connection string

### Workers
- `REDIS_HOST` - Redis host
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_KEY` - Service key
- `WORKER_CONCURRENCY` - Number of workers

## Port Mapping

- Frontend: 5173
- Backend: 3000
- PostgreSQL: 5432
- Redis: 6379
- Ollama: 11434

## Documentation Map

- [README.md](README.md) - Project overview
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design
- [SETUP.md](docs/SETUP.md) - Setup instructions
- [API.md](docs/API.md) - API reference
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guide
- [ROADMAP.md](ROADMAP.md) - Development phases
- [CHANGELOG.md](CHANGELOG.md) - Version history

## Code Quality Standards

- ✅ TypeScript (strict mode)
- ✅ ESLint
- ✅ Prettier
- ✅ async/await
- ✅ Proper error handling
- ✅ Structured logging
- ✅ Zod validation

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes and commit
git commit -m "feat: Add feature"

# Push to remote
git push origin feature/feature-name

# Create pull request
# Link related issues in PR description
```

## First Time Setup

```bash
# 1. Clone repository
git clone <repo>
cd LeadEngine

# 2. Install dependencies
npm install

# 3. Setup environment
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env.local
cp workers/.env.example workers/.env

# 4. Start Docker services
npm run docker:up

# 5. Run development servers
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev

# Terminal 3:
cd workers && python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m src.worker
```

## Troubleshooting Quick Links

- Port conflicts: Check SETUP.md - Troubleshooting section
- Docker issues: Run `docker-compose down -v && docker-compose build --no-cache`
- Database issues: Check PostgreSQL logs with `docker-compose logs postgres`
- Node issues: Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Useful Links

- [Supabase Documentation](https://supabase.com/docs)
- [Express Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev)
- [Material UI Documentation](https://mui.com)
- [Docker Documentation](https://docs.docker.com/)

---

**Last Updated:** 2026-06-10
