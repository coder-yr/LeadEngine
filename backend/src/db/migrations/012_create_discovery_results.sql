-- Migration: 012_create_discovery_results.sql
-- Description: Stores raw results from each discovery source before deduplication

CREATE TABLE IF NOT EXISTS discovery_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL,
    raw_name VARCHAR(255),
    raw_phone VARCHAR(50),
    raw_email VARCHAR(255),
    raw_website VARCHAR(512),
    raw_address TEXT,
    raw_rating VARCHAR(10),
    raw_data JSONB DEFAULT '{}',
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES discovery_results(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discovery_results_job_id ON discovery_results(job_id);
CREATE INDEX IF NOT EXISTS idx_discovery_results_source ON discovery_results(source);
CREATE INDEX IF NOT EXISTS idx_discovery_results_company_id ON discovery_results(company_id);
CREATE INDEX IF NOT EXISTS idx_discovery_results_is_duplicate ON discovery_results(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_discovery_results_raw_phone ON discovery_results(raw_phone);
CREATE INDEX IF NOT EXISTS idx_discovery_results_raw_website ON discovery_results(raw_website);

-- Add discovery tracking columns to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovery_job_id UUID REFERENCES discovery_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_discovery_source ON companies(discovery_source);
CREATE INDEX IF NOT EXISTS idx_companies_discovery_job_id ON companies(discovery_job_id);
