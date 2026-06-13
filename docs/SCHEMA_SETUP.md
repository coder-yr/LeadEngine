# Database Setup Guide - Phase 1

Complete guide for setting up the Supabase database for Phase 1.

## Overview

Phase 1 creates the foundational database schema with 6 core tables:
- `companies` - Business records
- `contacts` - Individual contacts
- `websites` - Website information
- `campaigns` - Outreach campaigns
- `messages` - Communications
- `activities` - Audit trail

## Quick Start

### 1. Apply Schema to Supabase

#### Option A: Using Supabase Dashboard

1. Go to [Supabase Console](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy entire contents of `backend/src/db/schema.sql`
6. Click **Run**
7. Verify all tables are created

#### Option B: Using Supabase CLI

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref your-project-id

# Push migrations
supabase db push

# Or run migration directly
supabase db remote set backend/src/db/migrations/001_create_base_schema.sql
```

#### Option C: Using psql (Direct PostgreSQL)

```bash
# Get connection string from Supabase dashboard
# Settings → Database → Connection string (URI)

psql "postgresql://user:password@host:5432/postgres" \
  -f backend/src/db/schema.sql
```

### 2. Load Sample Data (Optional)

To populate the database with test data:

```bash
# Using Supabase Dashboard
1. SQL Editor → New Query
2. Paste contents of backend/src/db/seed.sql
3. Click Run

# Or via psql
psql "postgresql://..." -f backend/src/db/seed.sql
```

### 3. Verify Setup

Check tables are created:

```sql
-- Run in SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected output:
-- activities
-- campaigns
-- companies
-- contacts
-- messages
-- websites
```

## Schema Details

### Tables Created

| Table | Records | Indexes | Constraints |
|-------|---------|---------|------------|
| companies | 5 | 6 | FK, check |
| contacts | 7 | 5 | FK, check |
| websites | 5 | 5 | FK, check, unique |
| campaigns | 3 | 5 | FK, check |
| messages | 2 | 8 | FK, check |
| activities | 4 | 6 | FK |

### Enums Created

- `company_size` - 7 size categories
- `company_status` - 4 statuses
- `contact_status` - 5 statuses
- `website_status` - 4 statuses
- `campaign_status` - 5 statuses
- `campaign_type` - 5 types
- `activity_type` - 12 types
- `message_status` - 6 statuses
- `message_type` - 5 types

### Extensions

- `uuid-ossp` - UUID generation
- `pg_trgm` - Trigram full-text search

## File Structure

```
backend/src/db/
├── schema.sql           # Main schema definition
├── seed.sql             # Sample data
├── migrations/
│   └── 001_create_base_schema.sql  # Migration file
└── docs/
    ├── SCHEMA_README.md # This file
    └── ER_DIAGRAM.md    # Entity relationships
```

## Key Features

### UUID Primary Keys

All tables use UUID (not serial integers) for global uniqueness:

```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

### Timestamps

Every table includes:

```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

Updated via automatic trigger.

### Foreign Keys

Proper relationships with cascading deletes:

```sql
CONSTRAINT fk_contacts_company FOREIGN KEY (company_id)
  REFERENCES companies(id) ON DELETE CASCADE
```

### Indexes

Optimized for common queries:

- Full-text search on names (GIN)
- Foreign key lookups
- Status filters
- Date-based sorting
- Scheduled message queue

### Row-Level Security

RLS enabled on all tables with policies for:
- View permissions
- Insert permissions
- Update permissions

### Data Validation

Constraints ensure data integrity:

```sql
-- Names not empty
CONSTRAINT companies_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)

-- Email or phone required
CONSTRAINT contacts_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)

-- Score ranges (0-100)
CONSTRAINT websites_seo_score_range CHECK (seo_score >= 0 AND seo_score <= 100)

-- Date logic
CONSTRAINT campaigns_dates CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
```

## Environment Setup

### 1. Get Supabase Credentials

From [Supabase Dashboard](https://app.supabase.com):

```
Settings → API → Project URL
Settings → API → Project API Keys
```

### 2. Update Backend .env

```bash
# backend/.env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### 3. Test Connection

```bash
# From backend folder
npm run db:migrate

# Or test connection
psql $DATABASE_URL -c "SELECT version();"
```

## Sample Data

### Companies Created

1. **TechFlow Solutions** - Tech company (prospect)
2. **Digital Rise Marketing** - Marketing agency (prospect)
3. **ShopHub Inc** - E-commerce (prospect)
4. **Strategy Partners LLC** - Consulting (prospect)
5. **DataViz Analytics** - SaaS startup (prospect)

### Contacts Created

7 total contacts across all companies:
- 5 as primary contacts (decision-makers)
- 2 as secondary contacts

### Websites Audited

5 websites with:
- SSL status
- Mobile-friendliness
- SEO scores
- Feature detection

### Campaigns

3 draft campaigns:
1. Q2 2026 Outreach Campaign
2. Website Development Proposals
3. First Follow-up Series

### Messages

2 draft emails ready to send

### Activities

4 audit trail entries:
- Company imported
- Contact enriched
- Website crawled
- Lead scored

## Common Tasks

### View All Companies

```sql
SELECT id, name, industry, status, created_at
FROM companies
ORDER BY created_at DESC;
```

### Get Contacts for a Company

```sql
SELECT c.first_name, c.last_name, c.email, c.title
FROM contacts c
WHERE c.company_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY c.is_primary_contact DESC, c.first_name;
```

### List Pending Audits

```sql
SELECT id, url, domain_name, status
FROM websites
WHERE status = 'pending_audit'
ORDER BY created_at DESC;
```

### Get Campaign Statistics

```sql
SELECT 
  id, name, campaign_type, status,
  target_count, sent_count, opened_count, clicked_count, replied_count,
  ROUND(CAST(opened_count AS NUMERIC) / NULLIF(sent_count, 0) * 100, 2) AS open_rate,
  ROUND(CAST(clicked_count AS NUMERIC) / NULLIF(sent_count, 0) * 100, 2) AS click_rate,
  ROUND(CAST(replied_count AS NUMERIC) / NULLIF(sent_count, 0) * 100, 2) AS reply_rate
FROM campaigns
ORDER BY created_at DESC;
```

### View Activity Timeline

```sql
SELECT 
  a.id, a.activity_type, a.description,
  c.first_name, c.last_name,
  comp.name,
  a.created_at
FROM activities a
LEFT JOIN contacts c ON a.contact_id = c.id
LEFT JOIN companies comp ON a.company_id = comp.id
ORDER BY a.created_at DESC
LIMIT 50;
```

## Backup & Recovery

### Backup Database

```bash
# Supabase automatic daily backups (free tier: 7 days)
# Manual backup via Supabase dashboard:
# Settings → Backups → Create Backup

# Or via pg_dump
pg_dump $DATABASE_URL -Fc > backup.sql

# And restore
pg_restore -d $DATABASE_URL backup.sql
```

## Troubleshooting

### UUID Extension Not Available

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Permission Issues

```sql
-- Verify user permissions
SELECT * FROM information_schema.role_table_grants
WHERE table_name='companies';
```

### RLS Blocking Reads

```sql
-- Temporarily disable for testing
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Re-enable
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
```

### Foreign Key Constraint Violated

```sql
-- Check constraints
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name='contacts' AND constraint_type='FOREIGN KEY';

-- View constraint details
SELECT * FROM information_schema.referential_constraints
WHERE constraint_name='fk_contacts_company';
```

## Next Steps

1. ✅ Schema created and tested
2. ✅ Sample data loaded
3. ✅ Connections verified
4. 👉 **Phase 2**: Implement API endpoints
5. **Phase 3**: Create authentication layer
6. **Phase 4**: Build discovery service

---

**Database Status:** Phase 1 Complete ✅  
**Version:** PostgreSQL 14+  
**Created:** 2026-06-10
