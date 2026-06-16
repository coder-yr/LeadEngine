-- Migration: 013_add_lead_scoring.sql
-- Description: Adds composite lead scoring columns to companies table

ALTER TABLE companies ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS intent_score INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS opportunity_score INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fit_score INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_scored_at TIMESTAMP WITH TIME ZONE;

-- Indexes for ranked queries
CREATE INDEX IF NOT EXISTS idx_companies_lead_score ON companies(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_intent_score ON companies(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_opportunity_score ON companies(opportunity_score DESC);
