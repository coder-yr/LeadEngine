-- LeadEngine V3 Phase 1: User Ownership Migration
-- Apply this in the Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Add user_id column to discovery_jobs
-- Nullable for backwards compatibility with existing records
ALTER TABLE discovery_jobs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_user_id
  ON discovery_jobs(user_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'discovery_jobs'
  AND column_name = 'user_id';
