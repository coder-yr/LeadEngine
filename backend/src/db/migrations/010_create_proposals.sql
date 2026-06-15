-- Migration: 010_create_proposals.sql
-- Description: Creates table to track generated PDF proposals

BEGIN;

CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    storage_path VARCHAR(1024) NOT NULL,
    public_url VARCHAR(2048) NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_proposals_company_id ON proposals(company_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_proposals_updated_at ON proposals;
CREATE TRIGGER trigger_proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_proposals_updated_at();

-- RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proposals" ON proposals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert proposals" ON proposals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update proposals" ON proposals FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete proposals" ON proposals FOR DELETE USING (auth.uid() IS NOT NULL);

COMMIT;
