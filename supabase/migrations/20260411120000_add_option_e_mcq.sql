ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_e text NOT NULL DEFAULT '';

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_correct_option_check;
ALTER TABLE questions ADD CONSTRAINT questions_correct_option_check
  CHECK (correct_option = ANY (ARRAY['a'::text, 'b'::text, 'c'::text, 'd'::text, 'e'::text]));

ALTER TABLE student_answers DROP CONSTRAINT IF EXISTS student_answers_selected_option_check;
ALTER TABLE student_answers ADD CONSTRAINT student_answers_selected_option_check
  CHECK (
    selected_option IS NULL
    OR selected_option = ANY (ARRAY['a'::text, 'b'::text, 'c'::text, 'd'::text, 'e'::text])
);
