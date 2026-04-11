import { Exam, ExamAttempt } from '@/lib/types';

export type StudentExamStatus =
  | 'completed'
  | 'in_progress'
  | 'expired'
  | 'upcoming'
  | 'available';

export function getStudentExamStatus(exam: Exam, attempt?: ExamAttempt | null): StudentExamStatus {
  const now = new Date();
  if (attempt?.is_graded) return 'completed';
  if (attempt && !attempt.submitted_at) return 'in_progress';
  if (exam.end_time && new Date(exam.end_time) < now) return 'expired';
  if (exam.start_time && new Date(exam.start_time) > now) return 'upcoming';
  return 'available';
}
