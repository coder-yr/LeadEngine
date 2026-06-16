-- Migration: 011_create_discovery_jobs.sql
-- Description: Creates the discovery_jobs table to track multi-source lead discovery runs

CREATE TABLE IF NOT EXISTS discovery_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    sources TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_raw_results INTEGER DEFAULT 0,
    total_after_dedup INTEGER DEFAULT 0,
    total_companies_created INTEGER DEFAULT 0,
    error_message TEXT,
    per_source_counts JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON discovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_created_at ON discovery_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_keyword_city ON discovery_jobs(keyword, city);

-- Trigger
CREATE OR REPLACE FUNCTION update_discovery_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_discovery_jobs_updated_at ON discovery_jobs;
CREATE TRIGGER trigger_discovery_jobs_updated_at
    BEFORE UPDATE ON discovery_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_discovery_jobs_updated_at();
