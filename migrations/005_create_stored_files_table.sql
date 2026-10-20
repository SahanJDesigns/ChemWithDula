-- ==============================================================================
-- Migration: 005_create_stored_files_table.sql
-- Description: Store all images, option images, and exam PDFs directly in Neon Postgres
-- ==============================================================================

CREATE TABLE IF NOT EXISTS stored_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stored_files_id ON stored_files(id);

