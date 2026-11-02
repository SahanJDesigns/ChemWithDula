-- ==============================================================================
-- Migration: 006_auto_update_marks_on_answer_change.sql
-- Description: Automatically update student answers (is_correct) and exam attempt marks
--              (score & total_points) whenever a teacher updates question answers or points.
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_exam_grades_on_question_change()
RETURNS TRIGGER AS $$
DECLARE
  target_exam_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_exam_id := OLD.exam_id;
  ELSE
    target_exam_id := NEW.exam_id;
  END IF;

  -- On UPDATE, only proceed if relevant fields changed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.correct_option IS NOT DISTINCT FROM NEW.correct_option 
       AND OLD.points IS NOT DISTINCT FROM NEW.points 
       AND OLD.exam_id IS NOT DISTINCT FROM NEW.exam_id THEN
      RETURN NEW;
    END IF;

    -- If exam_id changed, re-sync the old exam first
    IF OLD.exam_id IS DISTINCT FROM NEW.exam_id THEN
      UPDATE student_answers sa
      SET is_correct = (sa.selected_option IS NOT NULL AND sa.selected_option = q.correct_option)
      FROM questions q
      WHERE sa.question_id = q.id AND q.exam_id = OLD.exam_id;

      UPDATE exam_attempts ea
      SET 
        total_points = (
          SELECT COALESCE(SUM(points), 0)::INT
          FROM questions
          WHERE exam_id = ea.exam_id
        ),
        score = (
          SELECT COALESCE(SUM(
            CASE WHEN sa.selected_option = q.correct_option THEN q.points ELSE 0 END
          ), 0)::INT
          FROM questions q
          LEFT JOIN student_answers sa 
            ON sa.question_id = q.id 
            AND sa.attempt_id = ea.id
          WHERE q.exam_id = ea.exam_id
        ),
        is_graded = true
      WHERE ea.exam_id = OLD.exam_id
        AND (ea.is_graded = true OR ea.submitted_at IS NOT NULL);
    END IF;
  END IF;

  -- 1. Sync student_answers is_correct for target_exam_id
  UPDATE student_answers sa
  SET is_correct = (sa.selected_option IS NOT NULL AND sa.selected_option = q.correct_option)
  FROM questions q
  WHERE sa.question_id = q.id AND q.exam_id = target_exam_id;

  -- 2. Sync exam_attempts score and total_points for target_exam_id
  UPDATE exam_attempts ea
  SET 
    total_points = (
      SELECT COALESCE(SUM(points), 0)::INT
      FROM questions
      WHERE exam_id = ea.exam_id
    ),
    score = (
      SELECT COALESCE(SUM(
        CASE WHEN sa.selected_option = q.correct_option THEN q.points ELSE 0 END
      ), 0)::INT
      FROM questions q
      LEFT JOIN student_answers sa 
        ON sa.question_id = q.id 
        AND sa.attempt_id = ea.id
      WHERE q.exam_id = ea.exam_id
    ),
    is_graded = true
  WHERE ea.exam_id = target_exam_id
    AND (ea.is_graded = true OR ea.submitted_at IS NOT NULL);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to questions table
DROP TRIGGER IF EXISTS trigger_sync_exam_grades_on_question_change ON questions;
CREATE TRIGGER trigger_sync_exam_grades_on_question_change
AFTER INSERT OR UPDATE OR DELETE ON questions
FOR EACH ROW
EXECUTE FUNCTION sync_exam_grades_on_question_change();

-- Run one-time sync for any existing student answers & attempts across all exams
UPDATE student_answers sa
SET is_correct = (sa.selected_option IS NOT NULL AND sa.selected_option = q.correct_option)
FROM questions q
WHERE sa.question_id = q.id;

UPDATE exam_attempts ea
SET 
  total_points = (
    SELECT COALESCE(SUM(points), 0)::INT
    FROM questions
    WHERE exam_id = ea.exam_id
  ),
  score = (
    SELECT COALESCE(SUM(
      CASE WHEN sa.selected_option = q.correct_option THEN q.points ELSE 0 END
    ), 0)::INT
    FROM questions q
    LEFT JOIN student_answers sa 
      ON sa.question_id = q.id 
      AND sa.attempt_id = ea.id
    WHERE q.exam_id = ea.exam_id
  ),
  is_graded = true
WHERE ea.is_graded = true OR ea.submitted_at IS NOT NULL;

