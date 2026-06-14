-- ============================================================================
-- LeadEngine - Migration File
-- Migration Name: 004_create_company_ai_insights
-- Created: 2026-06-13
-- ============================================================================
-- This migration creates the company_ai_insights table for storing the 
-- Ollama-generated AI insights.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  services_needed JSONB DEFAULT '[]',
  reasoning TEXT NOT NULL,
  recommended_next_action TEXT NOT NULL,
  model_used VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent multiple active insights per company if we want a 1:1 relationship, 
  -- but allowing multiple allows for history. For now, let's keep one primary insight by making it unique.
  UNIQUE(company_id)
);

-- Index for querying insights easily
CREATE INDEX IF NOT EXISTS idx_company_ai_insights_company_id ON company_ai_insights(company_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_company_ai_insights_updated_at
BEFORE UPDATE ON company_ai_insights
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE company_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company_ai_insights" ON company_ai_insights
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert company_ai_insights" ON company_ai_insights
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update company_ai_insights" ON company_ai_insights
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE company_ai_insights IS 'Stores AI-generated intelligence and sales consulting insights produced by Ollama';

COMMIT;
