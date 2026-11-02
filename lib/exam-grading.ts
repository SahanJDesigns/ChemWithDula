import { sql } from '@/lib/db';

export interface ExamRegradeResult {
  examId: string;
  affectedAttempts: number;
  totalPoints: number;
  questionCount: number;
}

/**
 * Re-evaluates student_answers.is_correct and updates exam_attempts (score and total_points)
 * for all students who have submitted / attempted the given exam.
 */
export async function recalculateExamAttempts(examId: string): Promise<ExamRegradeResult> {
  if (!examId) {
    throw new Error('examId is required for recalculating exam attempts');
  }

  // 1. Update is_correct flag for all student answers in this exam
  await (sql as any)`
    UPDATE student_answers sa
    SET is_correct = (sa.selected_option IS NOT NULL AND sa.selected_option = q.correct_option)
    FROM questions q
    WHERE sa.question_id = q.id
      AND q.exam_id = ${examId};
  `;

  // 2. Update exam_attempts (score and total_points) for all submitted / graded attempts
  const updatedAttempts = await (sql as any)`
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
    WHERE ea.exam_id = ${examId}
      AND (ea.is_graded = true OR ea.submitted_at IS NOT NULL)
    RETURNING ea.id, ea.score, ea.total_points;
  `;

  // 3. Get total questions and points for stats
  const [stats] = await (sql as any)`
    SELECT 
      COUNT(*)::INT as question_count,
      COALESCE(SUM(points), 0)::INT as total_points
    FROM questions
    WHERE exam_id = ${examId};
  `;

  return {
    examId,
    affectedAttempts: updatedAttempts.length,
    totalPoints: stats?.total_points || 0,
    questionCount: stats?.question_count || 0,
  };
}

