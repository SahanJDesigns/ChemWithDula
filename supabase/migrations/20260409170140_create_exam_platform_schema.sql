/*
  # Exam Platform - Full Schema

  ## Tables Created
  1. `profiles` - User profiles with role (teacher/student)
  2. `exams` - Exams created by teachers with timing and publishing controls
  3. `questions` - MCQ questions with optional image support
  4. `exam_attempts` - Student exam attempts tracking start/submit time and scores
  5. `student_answers` - Individual student answers per question

  ## Security
  - RLS enabled on all tables
  - Teachers can only manage their own exams and questions
  - Students can only read published exams and manage their own attempts/answers
  - Storage bucket created for question images

  ## Notes
  - Unique constraint on (exam_id, student_id) in exam_attempts prevents duplicate attempts
  - Auto-grading is handled at the application level
  - Storage policies set up for question image uploads
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  duration_minutes int NOT NULL DEFAULT 60,
  start_time timestamptz,
  end_time timestamptz,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own exams, students see published"
  ON exams FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid() OR
    (is_published = true AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student'
    ))
  );

CREATE POLICY "Teachers can insert own exams"
  ON exams FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Teachers can update own exams"
  ON exams FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own exams"
  ON exams FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_text text NOT NULL DEFAULT '',
  image_url text,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_option text NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  order_index int NOT NULL DEFAULT 0,
  points int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View questions of accessible exams"
  ON questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
      AND (exams.teacher_id = auth.uid() OR exams.is_published = true)
    )
  );

CREATE POLICY "Teachers can insert questions to own exams"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id AND exams.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update questions in own exams"
  ON questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id AND exams.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id AND exams.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete questions in own exams"
  ON questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id AND exams.teacher_id = auth.uid()
    )
  );

-- Exam attempts table
CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score int,
  total_points int,
  is_graded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own attempts, teachers see attempts on their exams"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_attempts.exam_id AND exams.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can create own attempts"
  ON exam_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Students can update own attempts"
  ON exam_attempts FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Student answers table
CREATE TABLE IF NOT EXISTS student_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option text CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  is_correct boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own answers, teachers see answers on their exams"
  ON student_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_attempts
      WHERE exam_attempts.id = student_answers.attempt_id
      AND (
        exam_attempts.student_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM exams
          WHERE exams.id = exam_attempts.exam_id AND exams.teacher_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Students can insert own answers"
  ON student_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_attempts
      WHERE exam_attempts.id = student_answers.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can update own answers"
  ON student_answers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_attempts
      WHERE exam_attempts.id = student_answers.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_attempts
      WHERE exam_attempts.id = student_answers.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  );

-- Storage bucket for exam images
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-images', 'exam-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload exam images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exam-images');

CREATE POLICY "Anyone can view exam images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'exam-images');

CREATE POLICY "Teachers can delete exam images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'exam-images');
