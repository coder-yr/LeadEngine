# System Architecture

## Overview

LeadEngine follows a **modular, event-driven architecture** designed for scalability, maintainability, and independent deployment.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                 │
│                    http://localhost:5173                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (Express + TypeScript)              │
│                   http://localhost:3000                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route Handlers                                      │  │
│  │  - Leads                                             │  │
│  │  - Companies                                         │  │
│  │  - Contacts                                          │  │
│  │  - Reports & Exports                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Service Layer                                       │  │
│  │  - Lead Service                                      │  │
│  │  - Company Service                                   │  │
│  │  - Extraction Service                               │  │
│  │  - Scoring Service                                  │  │
│  │  - Export Service                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Repository Layer (Data Access)                     │  │
│  │  - Lead Repository                                  │  │
│  │  - Company Repository                               │  │
│  │  - Contact Repository                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Queue Manager (BullMQ)                             │  │
│  │  - Job Producer                                     │  │
│  │  - Event Bus                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└────┬─────────────┬─────────────┬─────────────┬─────────────┘
     │             │             │             │
     ▼             ▼             ▼             ▼
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Redis   │  │Supabase  │  │ Workers  │  │  Ollama  │
│ Cache   │  │PostgreSQL│  │ (Python) │  │   LLM    │
└─────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Core Principles

### 1. Layered Architecture

```
Controller/Route → Service → Repository → Database
                    ↓
              BullMQ Events
                    ↓
              Worker Processes
```

### 2. Event-Driven Communication

Services communicate via events rather than direct calls:

- `lead.discovered`
- `lead.extracted`
- `lead.enriched`
- `lead.scored`
- `lead.verified`

### 3. Separation of Concerns

- **Controllers:** HTTP request handling
- **Services:** Business logic
- **Repositories:** Data access abstraction
- **DTOs:** Data transfer objects with validation
- **Workers:** Async job processing

### 4. Type Safety

- TypeScript in backend and frontend
- Zod for runtime validation
- Strict tsconfig.json

## Project Folders

### Backend Structure

```
backend/src/
├── index.ts                 # Entry point
├── config/
│   ├── env.ts             # Environment variables
│   ├── database.ts        # Supabase connection
│   └── redis.ts           # Redis connection
├── api/
│   ├── routes/
│   │   ├── leads.ts       # Lead routes
│   │   ├── companies.ts   # Company routes
│   │   └── exports.ts     # Export routes
│   └── middleware/
│       ├── auth.ts        # Authentication
│       ├── validation.ts  # Request validation
│       └── errorHandler.ts
├── services/
│   ├── lead.service.ts
│   ├── company.service.ts
│   ├── extraction.service.ts
│   ├── scoring.service.ts
│   └── export.service.ts
├── repositories/
│   ├── lead.repository.ts
│   ├── company.repository.ts
│   └── contact.repository.ts
├── dto/
│   ├── lead.dto.ts
│   ├── company.dto.ts
│   └── export.dto.ts
├── types/
│   ├── models.ts
│   ├── enums.ts
│   └── errors.ts
├── queues/
│   ├── jobs.ts            # Job definitions
│   ├── workers.ts         # Job handlers
│   └── events.ts          # Event definitions
├── utils/
│   ├── logger.ts
│   ├── validators.ts
│   └── helpers.ts
└── db/
    └── migrations/        # SQL migrations
```

### Frontend Structure

```
frontend/src/
├── main.tsx              # Entry point
├── App.tsx               # Root component
├── components/
│   ├── Layout/
│   ├── Dashboard/
│   ├── Leads/
│   ├── Reports/
│   └── common/
├── pages/
│   ├── Dashboard.tsx
│   ├── Leads.tsx
│   ├── Reports.tsx
│   └── Settings.tsx
├── services/
│   ├── api.ts            # API client
│   ├── leads.ts
│   ├── companies.ts
│   └── exports.ts
├── hooks/
│   ├── useLeads.ts
│   ├── useCompanies.ts
│   └── useExports.ts
├── types/
│   └── models.ts
└── styles/
    └── theme.ts
```

### Workers Structure

```
workers/src/
├── worker.py             # Entry point
├── tasks/
│   ├── crawl.py          # Website crawling
│   ├── extract.py        # Data extraction
│   ├── score.py          # Lead scoring
│   └── verify.py         # Contact verification
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

## Data Flow

### Example: Lead Discovery Flow

```
1. Frontend → Backend API: POST /api/leads/search
                              ↓
2. Backend Service: Process search request
                              ↓
3. Backend → Redis Queue: Enqueue "lead.discover" job
                              ↓
4. Python Worker: Fetch leads from sources
                              ↓
5. Worker → Supabase: Insert leads
                              ↓
6. Worker → Redis Queue: Emit "lead.discovered" event
                              ↓
7. Backend Listener: Trigger extraction job
                              ↓
8. Python Worker: Crawl websites, extract data
                              ↓
9. Backend → Frontend: WebSocket update (via SignalR/polling)
                              ↓
10. Frontend: Display results
```

## Database Schema (PostgreSQL)

### Main Tables

- `companies` - Business records
- `contacts` - Individual contacts
- `websites` - Website metadata
- `audits` - Website audit reports
- `scores` - Lead scoring history
- `campaigns` - Marketing campaigns
- `activities` - User activities
- `messages` - Messages/notes
- `exports` - Export history

See migration files for full schema.

## API Contract

### REST Endpoints

```
GET    /api/health           # Health check
POST   /api/leads            # Create lead
GET    /api/leads            # List leads
GET    /api/leads/:id        # Get lead
PUT    /api/leads/:id        # Update lead
DELETE /api/leads/:id        # Delete lead

POST   /api/companies        # Create company
GET    /api/companies        # List companies
GET    /api/companies/:id    # Get company

POST   /api/exports          # Create export job
GET    /api/exports/:id      # Get export status
```

All endpoints return JSON with consistent format:

```json
{
  "success": true,
  "data": {...},
  "error": null,
  "timestamp": "2026-06-10T10:00:00Z"
}
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│            Vercel (Frontend)                    │
│          CI/CD Enabled                          │
│      Auto-deploys on main push                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            Railway (Backend API)                │
│          Docker containers                      │
│      Auto-deploys on Docker push                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│        Oracle Cloud Free VPS (Workers)          │
│        Python async workers                     │
│      Manual deployment / CI/CD                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│        Supabase Cloud (Database)                │
│      PostgreSQL + Auth + Storage                │
└─────────────────────────────────────────────────┘
```

## Security Architecture

- **Authentication:** Supabase JWT
- **Authorization:** Role-based (RBAC)
- **API Security:** CORS, Rate limiting
- **Data:** Encryption at rest & in transit
- **Secrets:** Environment variables (never committed)
- **Logging:** Audit trail for sensitive operations

## Scalability Strategy

### Current (Phase 0)

- Single backend instance
- Shared Redis
- Single worker instance

### Future (Phase 3+)

- Kubernetes orchestration
- Horizontal scaling (backend)
- Worker pools with auto-scaling
- Database read replicas
- Redis clusters
- Load balancing

---

**Last Updated:** 2026-06-10
