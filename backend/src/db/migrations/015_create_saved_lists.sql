-- Migration: 015_create_saved_lists.sql
-- Description: Creates schema for Apollo-style Saved Lists

BEGIN;

-- Main Saved Lists table
CREATE TABLE IF NOT EXISTS saved_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID, -- Can be linked to auth.users if auth is implemented
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for Companies
CREATE TABLE IF NOT EXISTS saved_list_companies (
    list_id UUID NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, company_id)
);

-- Junction table for Contacts
CREATE TABLE IF NOT EXISTS saved_list_contacts (
    list_id UUID NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, contact_id)
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_saved_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_saved_lists_updated_at ON saved_lists;
CREATE TRIGGER trigger_saved_lists_updated_at
    BEFORE UPDATE ON saved_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_lists_updated_at();

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_saved_list_companies_company_id ON saved_list_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_saved_list_contacts_contact_id ON saved_list_contacts(contact_id);

COMMIT;
