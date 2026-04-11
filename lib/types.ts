export interface Profile {
  id: string;
  full_name: string;
  role: 'teacher' | 'student';
  created_at: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  teacher_id: string;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  is_published: boolean;
  created_at: string;
  profiles?: Profile;
  questions?: Question[];
}

export interface Question {
  id: string;
  exam_id: string;
  question_text: string;
  image_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_option: 'a' | 'b' | 'c' | 'd' | 'e';
  order_index: number;
  points: number;
  created_at: string;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_points: number | null;
  is_graded: boolean;
  created_at: string;
  profiles?: Profile;
  exams?: Exam;
}

export interface StudentAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  is_correct: boolean | null;
  created_at: string;
}
