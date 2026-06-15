-- Migration: 008_create_tasks.sql
-- Description: Creates the tasks table and related enums for managing sales activities

BEGIN;

DO $$ BEGIN
    CREATE TYPE task_type AS ENUM (
        'Call Lead',
        'Send Proposal',
        'Follow Up',
        'Other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'Pending',
        'Completed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    type task_type NOT NULL DEFAULT 'Follow Up',
    status task_status NOT NULL DEFAULT 'Pending',
    title VARCHAR(255) NOT NULL,
    notes TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks" ON tasks
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert tasks" ON tasks
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update tasks" ON tasks
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

COMMIT;
