-- Migration: 009_create_outreach_sequences.sql
-- Description: Creates sequence tracking tables for multi-day outreach campaigns

BEGIN;

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM (
        'active',
        'paused',
        'completed',
        'bounced',
        'replied'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS campaign_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    day_offset INTEGER NOT NULL,
    channel message_type NOT NULL, -- reusing message_type enum (email, whatsapp, linkedin)
    template_subject VARCHAR(512),
    template_body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_campaign_step UNIQUE(campaign_id, step_number)
);

CREATE TABLE IF NOT EXISTS campaign_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    current_step_number INTEGER DEFAULT 1,
    status enrollment_status DEFAULT 'active',
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_enrollment UNIQUE(campaign_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign_id ON campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_campaign_id ON campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_contact_id ON campaign_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_status ON campaign_enrollments(status);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_outreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_campaign_steps_updated_at ON campaign_steps;
CREATE TRIGGER trigger_campaign_steps_updated_at
    BEFORE UPDATE ON campaign_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_outreach_updated_at();

DROP TRIGGER IF EXISTS trigger_campaign_enrollments_updated_at ON campaign_enrollments;
CREATE TRIGGER trigger_campaign_enrollments_updated_at
    BEFORE UPDATE ON campaign_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_outreach_updated_at();

-- RLS
ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign steps" ON campaign_steps FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert campaign steps" ON campaign_steps FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update campaign steps" ON campaign_steps FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete campaign steps" ON campaign_steps FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view campaign enrollments" ON campaign_enrollments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert campaign enrollments" ON campaign_enrollments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update campaign enrollments" ON campaign_enrollments FOR UPDATE USING (auth.uid() IS NOT NULL);

COMMIT;
