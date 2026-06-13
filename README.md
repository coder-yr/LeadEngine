# Lead Discovery Intelligence Platform

A production-grade, self-hosted alternative to Clay and Apollo for automated lead discovery, business intelligence, and outreach generation.

## 🎯 Overview

LeadEngine is a modular, event-driven platform designed to automatically:

- Discover businesses across multiple sources
- Crawl and extract business information
- Analyze website quality and digital maturity
- Score leads based on multiple factors
- Generate AI proposals and audits
- Export leads in multiple formats

## 📊 Business Context

Built for **Digital Rise Marketing** to power:

- Website Development
- WhatsApp Automation
- CRM Development
- Mobile App Development
- AI Chatbots
- SEO Services
- Digital Marketing

## 🏗️ Architecture

### Monorepo Structure

```
LeadEngine/
├── frontend/          # React + Vite + Material UI
├── backend/           # Node.js + Express + TypeScript
├── workers/           # Python async workers
├── docs/              # Architecture & API docs
├── docker-compose.yml
└── package.json       # Monorepo root
```

### Tech Stack

| Layer | Technologies |
|-------|---|
| **Frontend** | React 18, Vite, Material UI, TanStack Query |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | Supabase (PostgreSQL) |
| **Cache & Queues** | Redis, BullMQ |
| **Workers** | Python 3.11, Crawl4AI, Playwright |
| **AI** | Ollama, DeepSeek, Qwen, Llama |
| **Deployment** | Docker, Vercel (frontend), Railway (backend) |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Git

### Installation

1. **Clone the repository**

```bash
cd f:\yash\projects\LeadEngine
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment variables**

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env.local
cp workers/.env.example workers/.env
```

4. **Start development services**

```bash
npm run docker:up
```

5. **Run development servers**

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Workers
cd workers && python -m src.worker
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- API Docs: http://localhost:3000/api/docs

### Docker

**Start all services:**

```bash
npm run docker:up
```

**Stop all services:**

```bash
npm run docker:down
```

**View logs:**

```bash
npm run docker:logs
```

## 📦 Project Layout

### Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── types/
│   ├── hooks/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tsconfig.json
└── Dockerfile
```

### Backend (`backend/`)

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   └── middleware/
│   ├── services/
│   ├── repositories/
│   ├── dto/
│   ├── types/
│   ├── utils/
│   └── index.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

### Workers (`workers/`)

```
workers/
├── src/
│   ├── tasks/
│   ├── services/
│   ├── utils/
│   ├── types/
│   └── worker.py
├── requirements.txt
└── Dockerfile
```

## 🔧 Development

### Scripts

**Frontend:**

```bash
cd frontend

npm run dev        # Start dev server
npm run build      # Build for production
npm run lint       # Run ESLint
npm run type-check # TypeScript check
npm run preview    # Preview build
```

**Backend:**

```bash
cd backend

npm run dev        # Start dev server (hot reload)
npm run build      # Build for production
npm run start      # Run production build
npm run lint       # Run ESLint
npm run type-check # TypeScript check
npm run db:migrate # Run migrations
```

**Workers:**

```bash
cd workers

python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m src.worker     # Run worker
```

### Database Migrations

```bash
cd backend
npm run db:migrate
```

## 📋 Environment Variables

### Frontend

See [frontend/.env.example](frontend/.env.example)

### Backend

See [backend/.env.example](backend/.env.example)

### Workers

See [workers/.env.example](workers/.env.example)

## 🧪 Testing

```bash
npm run test --workspaces
```

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Setup Guide](docs/SETUP.md)

## 🐳 Docker Support

### Build Images

```bash
docker-compose build
```

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f workers
```

## 🎓 Code Quality Standards

- ✅ TypeScript (strict mode)
- ✅ ESLint + Prettier
- ✅ async/await patterns
- ✅ Repository pattern
- ✅ Service layer
- ✅ DTOs & validation (Zod)
- ✅ Comprehensive logging
- ✅ Error handling
- ✅ Unit & integration tests

## 📝 Project Phases

This is **Phase 0: Bootstrap**. Core infrastructure is set up.

Future phases will implement:

1. **Phase 1:** Database Schema & API Setup
2. **Phase 2:** Discovery Service
3. **Phase 3:** Crawling Engine
4. **Phase 4:** Intelligence & Scoring
5. And more...

## 🔐 Security

- Environment variables via `.env.local` (not committed)
- Supabase authentication
- CORS enabled
- Rate limiting ready
- Input validation with Zod
- SQL injection protection via ORM

## 🤝 Contributing

1. Create a feature branch
2. Follow code standards
3. Write tests
4. Create pull request

## 📄 License

MIT

## 👥 Team

Digital Rise Marketing

---

**Status:** Phase 0 - Bootstrap ✅  
**Last Updated:** 2026-06-10
