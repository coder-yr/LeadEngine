-- ============================================================================
-- LeadEngine V2 — Migration 005
-- Discovery Engine V2: Lead Identity, Source Reliability, Provenance, Stages
-- Created: 2026-07-04
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. LEAD_IDENTITIES — Central identity record (one per real-world business)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity signals (normalized for matching)
  normalized_name TEXT NOT NULL,
  normalized_domain TEXT,
  normalized_phone TEXT,            -- E.164 last 10 digits
  address_hash TEXT,                -- MD5 of normalized address
  gstin TEXT,                       -- GST registration number
  cin TEXT,                         -- Company Identification Number (MCA)

  -- Discovery pipeline stage
  stage TEXT NOT NULL DEFAULT 'DISCOVERED',
  -- Valid stages: DISCOVERED | IDENTITY_RESOLVED | WEBSITE_FOUND |
  --   WEBSITE_CRAWLED | CONTACTS_FOUND | AUDIT_COMPLETE | LEAD_SCORED | READY

  -- Document
  website_document JSONB,

  -- Source tracking
  source_count INTEGER DEFAULT 1,
  source_names JSONB DEFAULT '[]',  -- Array of source names that contributed

  -- Confidence
  identity_confidence FLOAT DEFAULT 0.0,

  -- Discovery job reference
  discovery_job_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_identities_normalized_phone
  ON lead_identities(normalized_phone)
  WHERE normalized_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_identities_normalized_domain
  ON lead_identities(normalized_domain)
  WHERE normalized_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_identities_stage
  ON lead_identities(stage);

CREATE INDEX IF NOT EXISTS idx_lead_identities_name_trgm
  ON lead_identities USING GIN (normalized_name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_identities_gstin
  ON lead_identities(gstin)
  WHERE gstin IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_identities_cin
  ON lead_identities(cin)
  WHERE cin IS NOT NULL;

-- Trigger
CREATE TRIGGER trigger_lead_identities_updated_at
  BEFORE UPDATE ON lead_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE lead_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view lead_identities" ON lead_identities
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role can manage lead_identities" ON lead_identities
  FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE lead_identities IS
  'Central identity record per real-world business. One identity may aggregate data from multiple discovery sources.';


-- ============================================================================
-- 2. LINK companies TO lead_identities
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS lead_identity_id UUID REFERENCES lead_identities(id) ON DELETE SET NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS discovery_confidence JSONB DEFAULT '{}';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS source_reliability JSONB DEFAULT '{}';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS telemetry JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_companies_lead_identity_id
  ON companies(lead_identity_id)
  WHERE lead_identity_id IS NOT NULL;


-- ============================================================================
-- 3. SOURCE_RELIABILITY — Live per-source stats and reliability scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_reliability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name TEXT NOT NULL UNIQUE,

  -- Run counts
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  blocked_runs INTEGER DEFAULT 0,

  -- Volume stats
  total_results INTEGER DEFAULT 0,
  total_contacts INTEGER DEFAULT 0,    -- results with phone
  total_websites INTEGER DEFAULT 0,    -- results with website
  total_runtime_sec FLOAT DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,

  -- Computed score
  reliability_score FLOAT DEFAULT 50.0,

  -- Timestamps
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_reliability_score
  ON source_reliability(reliability_score DESC);

COMMENT ON TABLE source_reliability IS
  'Live per-source reliability stats. Updated after every discovery run.';


-- ============================================================================
-- 4. FIELD_PROVENANCE — Per-field data lineage
-- ============================================================================

CREATE TABLE IF NOT EXISTS field_provenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_identity_id UUID NOT NULL REFERENCES lead_identities(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  value TEXT,
  source TEXT NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0.0,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_provenance_identity_field
  ON field_provenance(lead_identity_id, field_name);

COMMENT ON TABLE field_provenance IS
  'Per-field data lineage: where each value came from, confidence, and when.';


-- ============================================================================
-- 5. DISCOVERY_STAGES_LOG — Append-only stage transition log
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_stages_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_identity_id UUID NOT NULL REFERENCES lead_identities(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stages_log_lead_identity
  ON discovery_stages_log(lead_identity_id, created_at DESC);

COMMENT ON TABLE discovery_stages_log IS
  'Append-only log of all stage transitions. Used for pipeline debugging and resume.';


-- ============================================================================
-- 6. ENHANCE company_intelligence with confidence/source fields
-- ============================================================================

ALTER TABLE company_intelligence
  ADD COLUMN IF NOT EXISTS industry_confidence FLOAT DEFAULT 0.0;

ALTER TABLE company_intelligence
  ADD COLUMN IF NOT EXISTS industry_sources JSONB DEFAULT '[]';


COMMIT;
