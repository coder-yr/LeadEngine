-- Migration: 017_fix_cascade_deletion.sql
-- Description: Converts ON DELETE SET NULL to ON DELETE CASCADE for company foreign keys to support hard deletion.

-- Drop existing constraint on discovery_results
ALTER TABLE discovery_results
DROP CONSTRAINT IF EXISTS discovery_results_company_id_fkey;

-- Re-add constraint with CASCADE
ALTER TABLE discovery_results
ADD CONSTRAINT discovery_results_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;
