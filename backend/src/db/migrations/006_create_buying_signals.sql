-- Migration: 006_create_buying_signals.sql
-- Description: Creates the company_signals table to track intent scores and missing infrastructure

CREATE TABLE IF NOT EXISTS company_signals (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    no_website BOOLEAN DEFAULT false,
    no_crm BOOLEAN DEFAULT false,
    no_whatsapp BOOLEAN DEFAULT false,
    poor_seo BOOLEAN DEFAULT false,
    slow_website BOOLEAN DEFAULT false,
    no_booking_system BOOLEAN DEFAULT false,
    intent_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_signals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_company_signals_updated_at ON company_signals;
CREATE TRIGGER trigger_company_signals_updated_at
    BEFORE UPDATE ON company_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_company_signals_updated_at();
