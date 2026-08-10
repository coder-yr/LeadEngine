-- LeadEngine V3 Phase 2: Hybrid Discovery & RLS Migration
-- Apply this in the Supabase SQL Editor

BEGIN;

-- ============================================================================
-- 1. DISCOVERY RESULTS & JOBS SCHEMA UPDATE
-- ============================================================================

-- Add classification columns for Identity Resolution
ALTER TABLE discovery_results 
  ADD COLUMN IF NOT EXISTS result_type VARCHAR(20) CHECK (result_type IN ('EXISTING', 'NEW')),
  ADD COLUMN IF NOT EXISTS discovered_now BOOLEAN;

-- Add stats columns for multi-source tracking
ALTER TABLE discovery_jobs
  ADD COLUMN IF NOT EXISTS database_matches INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_results INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_existing INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_new INTEGER DEFAULT 0;

-- Note: We allow NULLs for existing historical rows.

-- ============================================================================
-- 2. PRIVATE RESOURCES RLS POLICIES
-- ============================================================================

-- A. discovery_jobs
-- We added user_id in Phase 1. Now we enforce RLS on it.
ALTER TABLE discovery_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own discovery_jobs" ON discovery_jobs;
CREATE POLICY "Users can view their own discovery_jobs" 
  ON discovery_jobs FOR SELECT 
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert discovery_jobs" ON discovery_jobs;
CREATE POLICY "Users can insert discovery_jobs" 
  ON discovery_jobs FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own discovery_jobs" ON discovery_jobs;
CREATE POLICY "Users can update their own discovery_jobs" 
  ON discovery_jobs FOR UPDATE 
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own discovery_jobs" ON discovery_jobs;
CREATE POLICY "Users can delete their own discovery_jobs" 
  ON discovery_jobs FOR DELETE 
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- B. campaigns (uses created_by)
DROP POLICY IF EXISTS "Users can view campaigns" ON campaigns;
CREATE POLICY "Users can view campaigns" 
  ON campaigns FOR SELECT 
  USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- C. tasks (uses created_by)
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
CREATE POLICY "Users can view tasks" 
  ON tasks FOR SELECT 
  USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- D. proposals (uses created_by)
DROP POLICY IF EXISTS "Users can view proposals" ON proposals;
CREATE POLICY "Users can view proposals" 
  ON proposals FOR SELECT 
  USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- E. activities (uses created_by)
DROP POLICY IF EXISTS "Users can view activities" ON activities;
CREATE POLICY "Users can view activities" 
  ON activities FOR SELECT 
  USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- F. messages (uses created_by)
DROP POLICY IF EXISTS "Users can view messages" ON messages;
CREATE POLICY "Users can view messages" 
  ON messages FOR SELECT 
  USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- ============================================================================
-- 3. GLOBAL COMPANY INTELLIGENCE
-- ============================================================================
-- The existing policies on `companies`, `contacts`, `websites`, `company_intelligence` 
-- are already:
-- CREATE POLICY "Users can view..." ON table FOR SELECT USING (auth.uid() IS NOT NULL);
-- This properly exposes them to all authenticated users for the Discovery Flywheel.
-- We are keeping these intact as per the requirement.

COMMIT;
