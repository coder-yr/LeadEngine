-- Migration: 014_add_chatbot_to_intelligence.sql
-- Description: Adds chatbot_detected to company_intelligence and no_chatbot to company_signals

BEGIN;

ALTER TABLE company_intelligence ADD COLUMN IF NOT EXISTS chatbot_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE company_signals ADD COLUMN IF NOT EXISTS no_chatbot BOOLEAN DEFAULT FALSE;

COMMIT;
