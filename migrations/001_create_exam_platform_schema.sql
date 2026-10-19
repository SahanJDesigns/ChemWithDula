-- ==============================================================================
-- Migration: 001_create_exam_platform_schema.sql
-- Description: Core schema for ChemWithDula on Neon Postgres
-- ==============================================================================

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now()
);

-- Users table for authentication & credentials
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles table (compatible with application profile queries)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  duration_minutes INT NOT NULL DEFAULT 60,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Questions table (initial MCQ options: a, b, c, d)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  order_index INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exam attempts table
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score INT,
  total_points INT,
  is_graded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

-- Student answers table
CREATE TABLE IF NOT EXISTS student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option TEXT CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_is_published ON exams(is_published);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt_id ON student_answers(attempt_id);
