-- Migration: 007_add_pipeline_stage.sql
-- Description: Adds a pipeline_stage column to the companies table for Kanban tracking

DO $$ BEGIN
    CREATE TYPE pipeline_stage AS ENUM (
        'Discovered',
        'Qualified',
        'Contacted',
        'Meeting Scheduled',
        'Proposal Sent',
        'Won',
        'Lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS pipeline_stage pipeline_stage DEFAULT 'Discovered';
