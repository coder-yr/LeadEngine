-- ============================================================================
-- LeadEngine Phase 6 - Migration File
-- Migration Name: 016_universal_discovery_fields
-- Created: 2026-06-21
-- ============================================================================
-- This migration adds global tracking fields for universal discovery 
-- to support industry agnostic logic.
-- ============================================================================

BEGIN;

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS industry_confidence NUMERIC CHECK (industry_confidence >= 0 AND industry_confidence <= 100),
ADD COLUMN IF NOT EXISTS decision_maker_score NUMERIC CHECK (decision_maker_score >= 0 AND decision_maker_score <= 100);

-- Also add industry if it doesn't already exist on companies (it should, but just to be safe)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS industry VARCHAR(255);

COMMIT;
