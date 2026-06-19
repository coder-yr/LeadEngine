-- Migration: 009_add_contact_enrichment_fields.sql
-- Description: Adds source, confidence_score, confidence_reason, verification_status, and last_verified_at to the contacts table for LinkedIn Enrichment v2.

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS source VARCHAR(255),
ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS confidence_reason TEXT,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;
