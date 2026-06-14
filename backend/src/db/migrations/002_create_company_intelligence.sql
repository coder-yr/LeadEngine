-- ============================================================================
-- LeadEngine Phase 6 - Migration File
-- Migration Name: 002_create_company_intelligence
-- Created: 2026-06-13
-- ============================================================================
-- This migration creates the company_intelligence schema for the new Apollo-style
-- Lead Intelligence Platform Module.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  website_exists BOOLEAN DEFAULT FALSE,
  website_score INTEGER CHECK (website_score >= 0 AND website_score <= 100),
  crm_detected BOOLEAN DEFAULT FALSE,
  booking_detected BOOLEAN DEFAULT FALSE,
  whatsapp_detected BOOLEAN DEFAULT FALSE,
  contact_form_detected BOOLEAN DEFAULT FALSE,
  social_profiles JSONB DEFAULT '[]',
  digital_maturity_score INTEGER CHECK (digital_maturity_score >= 0 AND digital_maturity_score <= 100),
  services_needed JSONB DEFAULT '[]',
  lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_intelligence_company_id ON company_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_company_intelligence_lead_score ON company_intelligence(lead_score DESC);

-- Trigger to automatically update the 'updated_at' column on modification
CREATE TRIGGER trigger_company_intelligence_updated_at
BEFORE UPDATE ON company_intelligence
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE company_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company_intelligence" ON company_intelligence
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert company_intelligence" ON company_intelligence
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update company_intelligence" ON company_intelligence
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE company_intelligence IS 'Stores the digital footprint and intelligence scoring for Apollo-style company filtering';

COMMIT;
