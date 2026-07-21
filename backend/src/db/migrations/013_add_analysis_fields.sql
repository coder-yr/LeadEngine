-- Migration: Add Analysis Fields to Companies Table
-- Up

ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(50) DEFAULT 'READY_FOR_ANALYSIS',
  ADD COLUMN IF NOT EXISTS analysis_progress JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS analysis_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS analysis_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS analysis_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS analysis_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS analysis_error TEXT,
  ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS needs_reanalysis BOOLEAN DEFAULT FALSE;

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_companies_analysis_status ON companies(analysis_status);
CREATE INDEX IF NOT EXISTS idx_companies_needs_reanalysis ON companies(needs_reanalysis);

-- Down
-- ALTER TABLE companies
--   DROP COLUMN IF EXISTS analysis_status,
--   DROP COLUMN IF EXISTS analysis_progress,
--   DROP COLUMN IF EXISTS analysis_started_at,
--   DROP COLUMN IF EXISTS analysis_completed_at,
--   DROP COLUMN IF EXISTS analysis_duration_ms,
--   DROP COLUMN IF EXISTS analysis_version,
--   DROP COLUMN IF EXISTS analysis_confidence,
--   DROP COLUMN IF EXISTS analysis_error,
--   DROP COLUMN IF EXISTS last_analyzed_at,
--   DROP COLUMN IF EXISTS needs_reanalysis;
