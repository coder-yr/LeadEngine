# Backend README

## Overview

Node.js/Express backend for LeadEngine Lead Discovery Intelligence Platform.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Cache:** Redis
- **Queue:** BullMQ
- **Logging:** Pino

## Structure

```
src/
├── index.ts              # Entry point
├── config/
│   ├── env.ts           # Environment variables
│   ├── database.ts      # Supabase connection
│   └── redis.ts         # Redis connection
├── api/
│   ├── routes/
│   ├── middleware/
│   └── controllers/
├── services/            # Business logic
├── repositories/        # Data access
├── dto/                 # Data transfer objects
├── types/               # TypeScript types
├── utils/               # Utilities
└── db/
    └── migrations/
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values.

### Run Migrations

```bash
npm run db:migrate
```

### Development

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### Build

```bash
npm run build
npm start
```

## API Endpoints

See [API documentation](../docs/API.md)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | ✓ |
| `PORT` | Server port | ✓ |
| `SUPABASE_URL` | Supabase project URL | ✓ |
| `SUPABASE_SERVICE_KEY` | Service key for admin access | ✓ |
| `REDIS_HOST` | Redis host | ✓ |
| `REDIS_PORT` | Redis port | ✓ |
| `DATABASE_URL` | PostgreSQL connection string | ✓ |
| `CORS_ORIGIN` | Allowed CORS origins | ✓ |

## Database

PostgreSQL via Supabase.

Migrations located in `src/db/migrations/`

Run migrations:

```bash
npm run db:migrate
```

## Logging

Uses Pino for structured logging.

Log level configured via `LOG_LEVEL` environment variable.

```bash
LOG_LEVEL=debug npm run dev
```

## Error Handling

All errors should be caught and logged properly:

```typescript
try {
  // code
} catch (error) {
  logger.error(error, 'Error description');
  throw new AppError('User-friendly message', 400);
}
```

## Testing

```bash
npm run test
npm run test:watch
npm run test:coverage
```

## Deployment

### Docker

```bash
docker build -t leadengine-backend .
docker run -p 3000:3000 --env-file .env.local leadengine-backend
```

### Railway/Heroku/VPS

1. Set environment variables
2. Run migrations: `npm run db:migrate`
3. Start: `npm start`

---

**Status:** Phase 0 - Bootstrap ✅
