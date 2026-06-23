-- Migration: 018_create_audit_jobs_and_timing.sql
-- Description: Creates audit_jobs for tracking status and adds execution timing metrics to website_audits

CREATE TABLE IF NOT EXISTS audit_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_company_id ON audit_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs(status);

ALTER TABLE website_audits ADD COLUMN IF NOT EXISTS fetch_time_ms INTEGER DEFAULT 0;
ALTER TABLE website_audits ADD COLUMN IF NOT EXISTS parse_time_ms INTEGER DEFAULT 0;
ALTER TABLE website_audits ADD COLUMN IF NOT EXISTS ai_time_ms INTEGER DEFAULT 0;
ALTER TABLE website_audits ADD COLUMN IF NOT EXISTS total_time_ms INTEGER DEFAULT 0;
