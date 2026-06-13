# Frontend README

## Overview

React + Vite frontend for LeadEngine Lead Discovery Intelligence Platform.

## Tech Stack

- **Framework:** React 18
- **Build Tool:** Vite
- **UI Library:** Material UI (MUI)
- **Data Fetching:** TanStack Query
- **HTTP Client:** Axios
- **Language:** TypeScript

## Structure

```
src/
├── main.tsx             # Entry point
├── App.tsx              # Root component
├── components/
│   ├── Layout/
│   ├── Dashboard/
│   ├── Leads/
│   ├── Reports/
│   └── common/
├── pages/
├── services/            # API clients
├── hooks/               # Custom hooks
├── types/               # TypeScript types
└── styles/
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

### Development

```bash
npm run dev
```

App runs on `http://localhost:5173`

### Build

```bash
npm run build
```

Output in `dist/`

### Preview Build

```bash
npm run preview
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL | ✓ |
| `VITE_SUPABASE_URL` | Supabase project URL | ✓ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | ✓ |

## Code Quality

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run type-check
```

## Testing

```bash
npm run test
npm run test:watch
npm run test:coverage
```

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Static Hosting

Build and serve `dist/` folder:

```bash
npm run build
```

## Project Structure Decisions

- **Vite** for fast HMR and optimized builds
- **MUI** for production-ready components
- **TanStack Query** for server state management
- **TypeScript** for type safety
- **Component-based** folder structure for scalability

---

**Status:** Phase 0 - Bootstrap ✅
