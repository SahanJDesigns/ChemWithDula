-- ==============================================================================
-- Migration: 004_add_pdf_exam_support.sql
-- Description: Add pdf_url and option_count to exams table for full PDF exam papers
-- ==============================================================================

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS option_count INT DEFAULT 5;

