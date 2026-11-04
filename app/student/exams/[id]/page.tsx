'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { neonClient as neon } from '@/lib/neon';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, Question, ExamAttempt, StudentAnswer } from '@/lib/types';
import {
  MCQ_OPTION_KEYS,
  MCQ_OPTION_LABELS,
  MCQ_OPTION_VALUES,
  getOptionImageUrl,
  type McqOptionLetter,
} from '@/lib/mcq-options';
import OptionDisplay from '@/components/OptionDisplay';
import NonDownloadablePdfViewer from '@/components/NonDownloadablePdfViewer';
import BubbleAnswerSheet from '@/components/BubbleAnswerSheet';
import { Button } from '@/components/ui/button';
import ExamTimer from '@/components/ExamTimer';
import {
  ArrowLeft,
  CirclePlay as PlayCircle,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  TriangleAlert as AlertTriangle,
  Trophy,
  Clock,
  BookOpen,
  FileText,
  Rows,
  Layers,
  X,
  ChevronUp,
  Lock,
  Unlock,
  ShieldCheck,
  Calendar,
  ArrowRight,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ExamSecurityGuard from '@/components/ExamSecurityGuard';

type Phase = 'loading' | 'preview' | 'active' | 'review';

function formatDeadlineCountdown(deadline: Date, now: Date): { text: string; isPassed: boolean } {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { text: 'Deadline has passed', isPassed: true };
  }
  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return { text: parts.join(' '), isPassed: false };
}

export default function StudentExamPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [now, setNow] = useState<Date>(() => new Date());
  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<(Exam & { pdf_url?: string | null; option_count?: number }) | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, McqOptionLetter>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, StudentAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<'split' | 'cards'>('split');
  const submitRef = useRef(false);

  const isTeacher = profile?.role === 'teacher';

  // In-memory caching and background submission state
  const questionsCacheRef = useRef<Question[]>([]);
  const latestOptionRef = useRef<Record<string, McqOptionLetter>>({});
  const activeSubmissionIdRef = useRef<Record<string, number>>({});

  interface FailedSubmissionInfo {
    questionId: string;
    questionIndex: number;
    questionNumber: number;
    option: McqOptionLetter;
    error?: string;
  }
  const [failedSubmission, setFailedSubmission] = useState<FailedSubmissionInfo | null>(null);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [syncingCount, setSyncingCount] = useState<number>(0);

  // Preload all question images into browser memory immediately
  const preloadQuestionImages = useCallback((qList: Question[]) => {
    if (typeof window === 'undefined') return;
    qList.forEach((q) => {
      if (q.image_url) {
        const img = new window.Image();
        img.src = q.image_url;
      }
      MCQ_OPTION_VALUES.forEach((opt) => {
        const optImg = getOptionImageUrl(q, opt);
        if (optImg) {
          const img = new window.Image();
          img.src = optImg;
        }
      });
    });
  }, []);

  // Fast restore from session cache on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedQ = sessionStorage.getItem(`exam_questions_${examId}`);
        if (cachedQ) {
          const parsed = JSON.parse(cachedQ);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuestions(parsed);
            questionsCacheRef.current = parsed;
            preloadQuestionImages(parsed);
          }
        }
        const cachedAns = sessionStorage.getItem(`exam_answers_${examId}`);
        if (cachedAns) {
          const parsed = JSON.parse(cachedAns);
          if (parsed && typeof parsed === 'object') {
            setAnswers((prev) => ({ ...parsed, ...prev }));
          }
        }
      } catch (e) {}
    }
  }, [examId, preloadQuestionImages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [examRes, attemptRes] = await Promise.all([
      neon.from('exams').select('*').eq('id', examId).maybeSingle(),
      neon
        .from('exam_attempts')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .maybeSingle(),
    ]);

    if (!examRes.data) {
      router.push('/student/dashboard');
      return;
    }
    setExam(examRes.data);

    // Download ALL questions at once and keep in memory
    const questionsRes = await neon
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .order('order_index');
    const qData: Question[] = questionsRes.data || [];
    setQuestions(qData);
    questionsCacheRef.current = qData;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`exam_questions_${examId}`, JSON.stringify(qData));
      } catch (e) {}
    }
    preloadQuestionImages(qData);

    const att = attemptRes.data;
    if (!att) {
      setPhase('preview');
      return;
    }

    setAttempt(att);
    const answersRes = await neon.from('student_answers').select('*').eq('attempt_id', att.id);
    const saved = answersRes.data || [];
    const ansMap: Record<string, McqOptionLetter> = {};
    const fullAnsMap: Record<string, StudentAnswer> = {};
    saved.forEach((a) => {
      ansMap[a.question_id] = a.selected_option as McqOptionLetter;
      fullAnsMap[a.question_id] = a;
    });
    setAnswers(ansMap);
    setSavedAnswers(fullAnsMap);

    if (att.submitted_at) {
      setPhase('review');
    } else {
      setPhase('active');
    }
  }, [examId, user, router, preloadQuestionImages]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
        return;
      }
      loadData();
    }
  }, [user, authLoading, loadData, router]);

  const startExam = async () => {
    if (!user || !exam || starting) return;
    setStarting(true);
    try {
      if (isTeacher) {
        // Clear previous teacher trial attempt so teacher can test cleanly
        await neon.from('exam_attempts').delete().eq('exam_id', exam.id).eq('student_id', user.id);
      }
      const { data, error } = await neon
        .from('exam_attempts')
        .insert({
          exam_id: exam.id,
          student_id: user.id,
          started_at: new Date().toISOString(),
          is_graded: false,
        })
        .select()
        .single();

      if (error) throw error;
      setAttempt(data);
      setPhase('active');
    } catch (err) {
      console.error('Failed to start exam:', err);
    } finally {
      setStarting(false);
    }
  };

  const resetTrialExam = async () => {
    if (!user || !exam) return;
    try {
      if (attempt) {
        await neon.from('exam_attempts').delete().eq('id', attempt.id);
      }
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`exam_answers_${examId}`);
      }
      setAttempt(null);
      setAnswers({});
      setSavedAnswers({});
      setCurrentQ(0);
      setPhase('preview');
    } catch (err) {
      console.error('Failed to reset trial exam:', err);
    }
  };

  // Background answer submission with up to 3 automatic retries
  const submitAnswerInBackground = useCallback(
    async (
      attemptId: string,
      questionId: string,
      option: McqOptionLetter,
      qIndex: number
    ) => {
      const submissionId = Date.now();
      activeSubmissionIdRef.current[questionId] = submissionId;
      latestOptionRef.current[questionId] = option;

      setSyncingCount((c) => c + 1);

      const maxRetries = 3;
      let attemptNum = 0;
      let success = false;
      let lastError: any = null;

      while (attemptNum < maxRetries && !success) {
        // If a newer answer was selected for this question, abort obsolete request
        if (activeSubmissionIdRef.current[questionId] !== submissionId) {
          setSyncingCount((c) => Math.max(0, c - 1));
          return;
        }

        attemptNum++;

        try {
          const { error } = await neon.from('student_answers').upsert(
            {
              attempt_id: attemptId,
              question_id: questionId,
              selected_option: option,
            },
            { onConflict: 'attempt_id,question_id' }
          );

          if (error) throw new Error(error.message || 'Failed to save');

          if (activeSubmissionIdRef.current[questionId] === submissionId) {
            success = true;
            // Clear any previous error notification for this question
            setFailedSubmission((prev) => (prev?.questionId === questionId ? null : prev));
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[Background Submit] Question ${qIndex + 1} attempt ${attemptNum}/3 failed:`, err);
          if (attemptNum < maxRetries) {
            await new Promise((res) => setTimeout(res, attemptNum * 1000));
          }
        }
      }

      setSyncingCount((c) => Math.max(0, c - 1));

      // If all 3 attempts failed and this is still the active choice:
      if (!success && activeSubmissionIdRef.current[questionId] === submissionId) {
        console.error(`[Background Submit] Question ${qIndex + 1} failed after ${maxRetries} attempts.`);

        // 1. Immediately go to the submission failed question!
        setCurrentQ(qIndex);

        // 2. Show popup modal
        setFailedSubmission({
          questionId,
          questionIndex: qIndex,
          questionNumber: qIndex + 1,
          option,
          error: lastError?.message || 'Connection error',
        });
      }
    },
    []
  );

  const clearAnswerInBackground = useCallback(
    async (attemptId: string, questionId: string, qIndex: number) => {
      const submissionId = Date.now();
      activeSubmissionIdRef.current[questionId] = submissionId;
      delete latestOptionRef.current[questionId];

      setSyncingCount((c) => c + 1);

      const maxRetries = 3;
      let attemptNum = 0;
      let success = false;
      let lastError: any = null;

      while (attemptNum < maxRetries && !success) {
        if (activeSubmissionIdRef.current[questionId] !== submissionId) {
          setSyncingCount((c) => Math.max(0, c - 1));
          return;
        }

        attemptNum++;
        try {
          const { error } = await neon
            .from('student_answers')
            .delete()
            .eq('attempt_id', attemptId)
            .eq('question_id', questionId);

          if (error) throw new Error(error.message || 'Failed to clear');

          if (activeSubmissionIdRef.current[questionId] === submissionId) {
            success = true;
            setFailedSubmission((prev) => (prev?.questionId === questionId ? null : prev));
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[Background Clear] Question ${qIndex + 1} attempt ${attemptNum}/3 failed:`, err);
          if (attemptNum < maxRetries) {
            await new Promise((res) => setTimeout(res, attemptNum * 1000));
          }
        }
      }

      setSyncingCount((c) => Math.max(0, c - 1));

      if (!success && activeSubmissionIdRef.current[questionId] === submissionId) {
        setCurrentQ(qIndex);
        setFailedSubmission({
          questionId,
          questionIndex: qIndex,
          questionNumber: qIndex + 1,
          option: '' as McqOptionLetter,
          error: lastError?.message || 'Connection error',
        });
      }
    },
    []
  );

  // Save answer: records in memory immediately, advances to next question without waiting, submits in background
  const saveAnswer = useCallback(
    (questionId: string, option: McqOptionLetter, specificIndex?: number) => {
      if (!attempt) return;

      // 1. Immediately store in memory
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: option };
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(`exam_answers_${examId}`, JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });

      // 2. Do not wait for server response — advance to next question immediately
      const qIndex =
        typeof specificIndex === 'number'
          ? specificIndex
          : questions.findIndex((q) => q.id === questionId);

      if (qIndex >= 0 && qIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentQ((prev) => (prev === qIndex ? qIndex + 1 : prev));
        }, 100);
      }

      // 3. Handle submission in background with up to 3 retries
      submitAnswerInBackground(attempt.id, questionId, option, qIndex >= 0 ? qIndex : 0);
    },
    [attempt, examId, questions, submitAnswerInBackground]
  );

  const clearAnswer = useCallback(
    (questionId: string) => {
      if (!attempt) return;

      setAnswers((prev) => {
        const next = { ...prev };
        delete next[questionId];
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(`exam_answers_${examId}`, JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });

      const qIndex = questions.findIndex((q) => q.id === questionId);
      clearAnswerInBackground(attempt.id, questionId, qIndex >= 0 ? qIndex : 0);
    },
    [attempt, examId, questions, clearAnswerInBackground]
  );

  const gradeAndSubmit = useCallback(async () => {
    if (!attempt || submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    const answersRes = await neon.from('student_answers').select('*').eq('attempt_id', attempt.id);
    const currentAnswers = answersRes.data || [];

    let score = 0;
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);

    const updates = questions.map((q) => {
      const ans = currentAnswers.find((a) => a.question_id === q.id);
      const selectedOpt = answers[q.id] || ans?.selected_option || null;
      const isCorrect = selectedOpt === q.correct_option;
      if (isCorrect) score += q.points;
      return {
        attempt_id: attempt.id,
        question_id: q.id,
        selected_option: selectedOpt,
        is_correct: isCorrect,
      };
    });

    await neon.from('student_answers').upsert(updates, { onConflict: 'attempt_id,question_id' });
    await neon
      .from('exam_attempts')
      .update({
        submitted_at: new Date().toISOString(),
        score,
        total_points: totalPoints,
        is_graded: true,
      })
      .eq('id', attempt.id);

    const finalAttempt = {
      ...attempt,
      submitted_at: new Date().toISOString(),
      score,
      total_points: totalPoints,
      is_graded: true,
    };
    setAttempt(finalAttempt);

    const ansMap: Record<string, StudentAnswer> = {};
    updates.forEach((u) => {
      ansMap[u.question_id] = { ...u, id: '', created_at: '' };
    });
    setSavedAnswers(ansMap);
    setPhase('review');
    setSubmitting(false);
  }, [attempt, questions, answers]);

  const handleTimeUp = useCallback(() => {
    gradeAndSubmit();
  }, [gradeAndSubmit]);

  if (phase === 'loading' || authLoading) {
    return (
      <DashboardLayout role={isTeacher ? 'teacher' : 'student'}>
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!exam) return null;

  /* ───────────────────────────────────────────────────────────────────────── */
  /* PREVIEW SCREEN                                                            */
  /* ───────────────────────────────────────────────────────────────────────── */
  if (phase === 'preview') {
    const isBeforeStart = exam.start_time && new Date(exam.start_time) > now;
    const isAfterEnd = exam.end_time && new Date(exam.end_time) < now;
    const isPdfExam = Boolean(exam.pdf_url);

    return (
      <DashboardLayout role={isTeacher ? 'teacher' : 'student'}>
        {isTeacher && (
          <div className="bg-amber-500/10 border-b border-amber-300 text-amber-950 px-4 py-2 text-xs font-medium flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
            <span className="font-semibold flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] uppercase">
                Teacher Trial
              </span>
              Testing exam in live student simulation. Answers will not affect student analytics.
            </span>
            <Link href={`/teacher/exams/${exam.id}`} className="underline font-semibold hover:text-amber-700">
              Back to Exam Editor
            </Link>
          </div>
        )}
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-3">
                {isPdfExam ? <FileText className="h-3.5 w-3.5 text-emerald-600" /> : <BookOpen className="h-3.5 w-3.5 text-primary" />}
                <span>{isPdfExam ? 'Official PDF Paper & Bubble Sheet' : 'Interactive MCQ Exam'}</span>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-2">{exam.title}</h1>
              {exam.description && (
                <p className="text-slate-500 mb-6 text-sm leading-relaxed">{exam.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-1">Questions</p>
                  <p className="text-xl font-bold text-slate-900">{questions.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-1">Time Limit</p>
                  <p className="text-xl font-bold text-slate-900">{exam.duration_minutes} min</p>
                </div>
                {exam.start_time && (
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">Opens</p>
                    <p className="text-xs font-semibold text-slate-700">
                      {new Date(exam.start_time).toLocaleString()}
                    </p>
                  </div>
                )}
                {exam.end_time && (
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">Closes</p>
                    <p className="text-xs font-semibold text-slate-700">
                      {new Date(exam.end_time).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-left mb-6">
                <div className="flex gap-2.5">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" size={18} />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">උපදෙස් / Instructions:</p>
                    <ul className="space-y-1 text-xs text-amber-900/90">
                      <li>&bull; මෙම ප්‍රශ්න පත්‍රයේ ප්‍රශ්න {questions.length}ක් ඇත.</li>
                      <li>&bull; ප්‍රශ්න කියවා පිළිතුරු සලකුණු කළ වහාම ඊළඟ ප්‍රශ්නයට යොමුවේ.</li>
                      <li>&bull; පිළිතුරු ස්වයංක්‍රීයව පසුබිමින් (background) සුරැකේ.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {(isBeforeStart && !isTeacher) ? (
                <p className="text-sm text-slate-500">
                  This exam opens on {new Date(exam.start_time!).toLocaleString()}
                </p>
              ) : (isAfterEnd && !isTeacher) ? (
                <p className="text-sm text-red-500">This exam has closed.</p>
              ) : (
                <Button
                  onClick={startExam}
                  disabled={starting}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-semibold shadow-sm"
                >
                  {starting ? (
                    <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <PlayCircle className="h-5 w-5 mr-2" />
                      {isTeacher ? 'Start Exam (Teacher Trial)' : 'Start Exam'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* ───────────────────────────────────────────────────────────────────────── */
  /* REVIEW SCREEN (POST-SUBMISSION)                                           */
  /* ───────────────────────────────────────────────────────────────────────── */
  if (phase === 'review' && attempt) {
    const pct = attempt.total_points
      ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
      : 0;
    const getGrade = (p: number) => {
      if (p >= 75) return { label: 'A', color: 'text-emerald-600' };
      if (p >= 65) return { label: 'B', color: 'text-emerald-600' };
      if (p >= 55) return { label: 'C', color: 'text-primary' };
      if (p >= 35) return { label: 'S', color: 'text-amber-600' };
      return { label: 'W', color: 'text-red-600' };
    };
    const grade = getGrade(pct);
    const isPdfExam = Boolean(exam.pdf_url);
    const optionCount = exam.option_count || 5;

    const deadlineDate = exam.end_time ? new Date(exam.end_time) : null;
    const isDeadlinePassed = isTeacher || !deadlineDate || now.getTime() >= deadlineDate.getTime();
    const countdown = deadlineDate ? formatDeadlineCountdown(deadlineDate, now) : null;

    return (
      <DashboardLayout role={isTeacher ? 'teacher' : 'student'}>
        {isTeacher && (
          <div className="bg-amber-500/10 border-b border-amber-300 text-amber-950 px-4 py-2 text-xs font-medium flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
            <span className="font-semibold flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] uppercase">
                Teacher Trial Results
              </span>
              Immediate solutions unlocked.
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={resetTrialExam}
                className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-50 text-amber-900"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Try Again
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-50 text-amber-900"
              >
                <Link href={`/teacher/exams/${exam.id}`}>
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Back to Editor
                </Link>
              </Button>
            </div>
          </div>
        )}
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-6 px-4 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Score Summary Card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Exam Completed
                    </span>
                    {!isDeadlinePassed && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        <Lock className="h-3 w-3" />
                        Paper Preview Locked
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{exam.title}</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Submitted: {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '—'}
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/80">
                  <div className="text-center pr-3 border-r border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">
                      {attempt.score} / {attempt.total_points}
                    </p>
                  </div>
                  <div className="text-center pr-3 border-r border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</p>
                    <p className={`text-xl sm:text-2xl font-black ${grade.color}`}>
                      {grade.label} <span className="text-xs font-normal text-slate-500">({pct}%)</span>
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</p>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Graded
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {!isDeadlinePassed ? (
              /* LOCKED PAPER & SOLUTIONS NOTICE */
              <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/70 via-white to-slate-50 p-6 sm:p-10 shadow-xs text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 shadow-xs mb-5">
                  <Lock className="h-8 w-8" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 text-xs font-semibold mb-3 border border-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                  <span>Paper Preview Locked Until Deadline</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                  ප්‍රශ්න පත්‍රය සහ පිළිතුරු විභාග අවසාන දිනයෙන් පසු ප්‍රදර්ශනය කෙරේ
                </h2>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Question paper preview & detailed solutions will unlock after the deadline
                </p>
                <p className="max-w-2xl mx-auto text-xs text-slate-500 leading-relaxed mb-6">
                  ඔබගේ ලකුණු (Score: {attempt.score} / {attempt.total_points}) ඉහත සටහන් කර ඇත. විභාගයේ රහස්‍යභාවය හා සාධාරණත්වය ආරක්ෂා කිරීම සඳහා, සම්පූර්ණ ප්‍රශ්න පත්‍රය සහ නිවැරදි පිළිතුරු දැකබලා ගැනීම අවසාන දිනය තෙක් අත්හිටුවා ඇත.
                </p>

                {/* Deadline & Countdown cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-8 text-left">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>Submission Deadline</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {deadlineDate?.toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 mb-1">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Time Remaining</span>
                    </div>
                    <p className="text-base font-black text-amber-900 tracking-wide font-mono">
                      {countdown?.text || 'Soon'}
                    </p>
                  </div>
                </div>

                {/* Navigation actions */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/student/dashboard')}
                    className="h-10 text-xs sm:text-sm font-semibold"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back to My Exams
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => router.push('/student/results')}
                    className="h-10 text-xs sm:text-sm font-semibold bg-primary hover:bg-primary/90"
                  >
                    View All Results
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            ) : (
              /* UNLOCKED FULL PAPER PREVIEW */
              <>
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <Unlock className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs sm:text-sm font-semibold">
                      Exam Deadline Passed — Full Paper & Solution Preview Unlocked
                    </span>
                  </div>
                  <span className="text-xs text-emerald-700 hidden sm:inline">
                    {deadlineDate ? `Closed on ${deadlineDate.toLocaleDateString()}` : 'Available'}
                  </span>
                </div>

                {/* If PDF Exam, render split screen or toggle */}
                {isPdfExam ? (
                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* Left: Protected PDF Reader */}
                    <div className="w-full lg:flex-1 min-w-0">
                      <NonDownloadablePdfViewer
                        pdfUrl={exam.pdf_url!}
                        title={exam.title}
                        className="h-[650px] lg:h-[750px]"
                      />
                    </div>

                    {/* Right: Bubble Answer Sheet with Results */}
                    <div className="w-full lg:w-[380px] shrink-0 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Answer Key & Results</h3>
                          <p className="text-[11px] text-slate-500">
                            Green = Correct &bull; Red = Incorrect &bull; Circle = Correct Answer
                          </p>
                        </div>
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          {attempt.score}/{attempt.total_points}
                        </span>
                      </div>
                      <div className="max-h-[680px] overflow-y-auto">
                        <BubbleAnswerSheet
                          questions={questions}
                          answers={answers}
                          optionCount={optionCount}
                          showResults={true}
                          disabled={true}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Non-PDF Question Cards Review */
                  <div className="space-y-4">
                    {questions.map((q, idx) => {
                      const ans = savedAnswers[q.id];
                      const isCorrect = ans?.is_correct;
                      const selected = ans?.selected_option;
                      return (
                        <div
                          key={q.id}
                          className={`rounded-xl border p-5 ${
                            isCorrect
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-red-200 bg-red-50/30'
                          }`}
                        >
                          <div className="flex items-start gap-3 mb-3">
                            {isCorrect ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Question {idx + 1} &bull; {q.points} pt{q.points !== 1 ? 's' : ''}
                              </p>
                              {q.image_url && (
                                <Image
                                  src={q.image_url}
                                  alt="Question"
                                  width={0}
                                  height={140}
                                  className="rounded-lg border border-slate-200 mb-3 w-full h-auto object-contain"
                                />
                              )}
                              {q.question_text && (
                                <p className="text-sm font-medium text-slate-800 mb-3">
                                  {q.question_text}
                                </p>
                              )}
                              <div className="space-y-1.5">
                                {MCQ_OPTION_VALUES.map((opt, i) => {
                                  const optKey = MCQ_OPTION_KEYS[i];
                                  const optImg = getOptionImageUrl(q, opt);
                                  const isCorrectOpt = q.correct_option === opt;
                                  const isSelectedOpt = selected === opt;
                                  return (
                                    <div
                                      key={opt}
                                      className={`flex items-start justify-between gap-3 rounded-xl p-3 text-sm border ${
                                        isCorrectOpt && isSelectedOpt
                                          ? 'bg-emerald-100/80 border-emerald-300 text-emerald-900 font-medium'
                                          : isCorrectOpt
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                                            : isSelectedOpt
                                              ? 'bg-red-100/80 border-red-300 text-red-800'
                                              : 'bg-white border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      <OptionDisplay
                                        letter={opt}
                                        text={q[optKey]}
                                        imageUrl={optImg}
                                        className="flex-1"
                                      />
                                      <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                                        {isCorrectOpt && (
                                          <span className="text-xs font-bold text-emerald-600">Correct</span>
                                        )}
                                        {isSelectedOpt && !isCorrectOpt && (
                                          <span className="text-xs font-bold text-red-500">Your choice</span>
                                        )}
                                        {isCorrectOpt && (
                                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        )}
                                        {isSelectedOpt && !isCorrectOpt && (
                                          <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* ───────────────────────────────────────────────────────────────────────── */
  /* ACTIVE EXAM SCREEN                                                        */
  /* ───────────────────────────────────────────────────────────────────────── */
  if (phase === 'active' && attempt && exam) {
    const answeredCount = Object.keys(answers).length;
    const isPdfExam = Boolean(exam.pdf_url);
    const optionCount = exam.option_count || 5;
    const question = questions[currentQ];

    const failedSubmissionModal = failedSubmission && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-red-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 mx-auto mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
            Submission Failed
          </h3>
          <p className="text-sm text-slate-600 text-center mb-4 leading-relaxed">
            Your answer for <span className="font-bold text-red-600">Question {failedSubmission.questionNumber}</span> could not be saved to the server after 3 attempts.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 mb-6 space-y-1">
            <p className="font-semibold text-amber-950 flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Navigated to Question {failedSubmission.questionNumber}
            </p>
            <p className="text-amber-800">
              Your selected answer is still stored in memory on your device. Please verify your internet connection and retry saving.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setFailedSubmission(null)}
            >
              Dismiss
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={isRetryingFailed}
              onClick={async () => {
                if (!attempt) return;
                setIsRetryingFailed(true);
                const failed = failedSubmission;
                setCurrentQ(failed.questionIndex);
                await submitAnswerInBackground(
                  attempt.id,
                  failed.questionId,
                  failed.option,
                  failed.questionIndex
                );
                setIsRetryingFailed(false);
              }}
            >
              {isRetryingFailed ? (
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1.5" />
              )}
              Retry Submission
            </Button>
          </div>
        </div>
      </div>
    );

    /* ── SCENARIO A: FULL PDF EXAM PAPER + RIGHT BUBBLE SHEET ── */
    if (isPdfExam) {
      return (
        <ExamSecurityGuard
          isActive={true}
          studentName={profile?.full_name || user?.email?.split('@')[0] || (isTeacher ? 'Teacher' : 'Student')}
          studentEmail={user?.email || ''}
          examTitle={exam.title}
        >
          <div className="bg-slate-900 min-h-screen flex flex-col">
          {/* Top Exam Header */}
          <div className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 flex items-center justify-between h-14 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                <h2 className="font-semibold text-sm truncate max-w-[160px] sm:max-w-xs md:max-w-md">
                  {exam.title}
                </h2>
                <span className="hidden sm:inline-block text-xs bg-slate-800 text-emerald-300 px-2 py-0.5 rounded-full font-medium border border-slate-700">
                  {answeredCount}/{questions.length} answered
                </span>
                {syncingCount > 0 ? (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2.5 py-0.5 rounded-full font-medium">
                    <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                    Saving...
                  </span>
                ) : failedSubmission ? (
                  <button
                    onClick={() => setCurrentQ(failedSubmission.questionIndex)}
                    className="hidden sm:inline-flex items-center gap-1 text-xs text-red-300 bg-red-950/70 border border-red-800 px-2.5 py-0.5 rounded-full hover:bg-red-900 transition-colors"
                  >
                    <AlertTriangle className="h-3 w-3 text-red-400" />
                    Failed Q{failedSubmission.questionNumber}
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-0.5 rounded-full font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Saved
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <ExamTimer
                  startedAt={attempt.started_at}
                  durationMinutes={exam.duration_minutes}
                  onTimeUp={handleTimeUp}
                />

                {/* Mobile Drawer Trigger (Hidden on Desktop) */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
                  className="lg:hidden h-8 px-2.5 text-xs border-emerald-500 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
                >
                  <Rows className="h-3.5 w-3.5 mr-1" />
                  <span>Sheet ({answeredCount}/{questions.length})</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-8.5 px-4 shadow-sm"
                >
                  Finish & Submit
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Main Area: Split Screen */}
          <div className="flex-1 mx-auto w-full max-w-7xl p-3 sm:p-4 flex flex-col lg:flex-row gap-4 overflow-hidden">
            {/* Left: Non-Downloadable Protected PDF Viewer */}
            <div className="flex-1 min-w-0 h-[calc(100vh-6.5rem)] lg:h-[calc(100vh-5.5rem)]">
              <NonDownloadablePdfViewer
                pdfUrl={exam.pdf_url!}
                title={exam.title}
                className="h-full w-full"
              />
            </div>

            {/* Right: Answer Sheet (OMR Bubble Dots) - Desktop Sticky Sidebar */}
            <div className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col bg-white rounded-xl border border-slate-700 shadow-xl overflow-hidden h-[calc(100vh-5.5rem)]">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Answer Sheet (OMR)</h3>
                  <p className="text-[11px] text-slate-500">
                    Click a dot (1–{optionCount}) to mark answer
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {answeredCount} / {questions.length}
                  </span>
                </div>
              </div>

              {/* Scrollable Bubble Sheet */}
              <div className="flex-1 overflow-y-auto">
                <BubbleAnswerSheet
                  questions={questions}
                  answers={answers}
                  optionCount={optionCount}
                  activeQuestionIndex={currentQ}
                  onQuestionClick={(idx) => setCurrentQ(idx)}
                  onSelectAnswer={saveAnswer}
                  onClearAnswer={clearAnswer}
                />
              </div>

              {/* Submit footer button */}
              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <Button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Review & Submit Exam
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Bottom Floating Bar & Drawer */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 p-2.5 flex items-center justify-between backdrop-blur-md">
            <button
              onClick={() => setMobileSheetOpen(true)}
              className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-slate-800 px-3 py-2 rounded-lg border border-slate-700"
            >
              <Rows className="h-4 w-4" />
              <span>Tap to Open Answer Sheet ({answeredCount}/{questions.length})</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>

            <Button
              size="sm"
              onClick={() => setShowSubmitConfirm(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-3"
            >
              Submit
            </Button>
          </div>

          {/* Mobile Slide-Up Drawer */}
          {mobileSheetOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
              <div className="w-full max-h-[85vh] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Answer Sheet (OMR)</h3>
                    <p className="text-xs text-slate-500">
                      Answered: {answeredCount} of {questions.length}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileSheetOpen(false)}
                    className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  <BubbleAnswerSheet
                    questions={questions}
                    answers={answers}
                    optionCount={optionCount}
                    activeQuestionIndex={currentQ}
                    onQuestionClick={(idx) => setCurrentQ(idx)}
                    onSelectAnswer={saveAnswer}
                    onClearAnswer={clearAnswer}
                  />
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => setMobileSheetOpen(false)}
                  >
                    Back to Paper
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    onClick={() => {
                      setMobileSheetOpen(false);
                      setShowSubmitConfirm(true);
                    }}
                  >
                    Submit Exam
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Submit confirmation modal */}
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 mx-auto mb-4">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Submit Exam?</h3>
                <p className="text-sm text-slate-500 text-center mb-2">
                  You have answered <span className="font-semibold text-slate-700">{answeredCount}</span> of{' '}
                  <span className="font-semibold text-slate-700">{questions.length}</span> questions.
                </p>
                {answeredCount < questions.length && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-center mb-4">
                    {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} left unanswered.
                  </p>
                )}
                <p className="text-xs text-slate-400 text-center mb-6">This action cannot be undone.</p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowSubmitConfirm(false)}>
                    Go Back
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={gradeAndSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      'Submit Now'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Failed submission popup */}
          {failedSubmissionModal}
        </div>
      </ExamSecurityGuard>
    );
  }

    /* ── SCENARIO B: TRADITIONAL QUESTION CARDS (BACKWARD COMPATIBLE) ── */
    return (
      <ExamSecurityGuard
        isActive={true}
        studentName={profile?.full_name || user?.email?.split('@')[0] || (isTeacher ? 'Teacher' : 'Student')}
        studentEmail={user?.email || ''}
        examTitle={exam.title}
      >
        <div className="bg-slate-50 min-h-screen">
        {/* Exam header bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-semibold text-slate-900 text-sm truncate">{exam.title}</h2>
              <span className="text-xs text-slate-400 shrink-0">
                {answeredCount}/{questions.length} answered
              </span>
              {syncingCount > 0 ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                  Saving...
                </span>
              ) : failedSubmission ? (
                <button
                  onClick={() => setCurrentQ(failedSubmission.questionIndex)}
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded-full font-semibold transition-colors"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Failed Q{failedSubmission.questionNumber}
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ExamTimer
                startedAt={attempt.started_at}
                durationMinutes={exam.duration_minutes}
                onTimeUp={handleTimeUp}
              />
              <Button
                size="sm"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 h-9"
              >
                Submit
              </Button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Question panel */}
            <div className="lg:col-span-3">
              {question && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                    Question {currentQ + 1} of {questions.length} &bull; {question.points} pt
                    {question.points !== 1 ? 's' : ''}
                  </p>
                  {question.image_url && (
                    <div className="mb-4">
                      <Image
                        src={question.image_url}
                        alt="Question"
                        width={0}
                        height={140}
                        className="rounded-lg border border-slate-200 mb-3 w-full h-auto object-contain"
                      />
                    </div>
                  )}
                  {question.question_text && (
                    <p className="text-base font-medium text-slate-900 mb-6 leading-relaxed">
                      {question.question_text}
                    </p>
                  )}
                  <div className="space-y-3">
                    {MCQ_OPTION_VALUES.map((opt, i) => {
                      const optKey = MCQ_OPTION_KEYS[i];
                      const optImg = getOptionImageUrl(question, opt);
                      const isSelected = answers[question.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => saveAnswer(question.id, opt, currentQ)}
                          className={`w-full flex items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 text-left text-sm transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 ${
                              isSelected ? 'border-primary bg-primary' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <OptionDisplay
                            letter={opt}
                            text={question[optKey]}
                            imageUrl={optImg}
                            className="flex-1"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
                      disabled={currentQ === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant={currentQ === questions.length - 1 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (currentQ < questions.length - 1) setCurrentQ((p) => p + 1);
                        else setShowSubmitConfirm(true);
                      }}
                      className={currentQ === questions.length - 1 ? 'bg-primary hover:bg-primary/90' : ''}
                    >
                      {currentQ === questions.length - 1 ? 'Finish & Submit' : 'Next'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Question nav sidebar */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sticky top-20">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Questions
                </p>
                <div className="grid grid-cols-5 gap-1.5 lg:grid-cols-4">
                  {questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQ(idx)}
                      className={`h-9 rounded-lg text-xs font-semibold transition-all ${
                        currentQ === idx
                          ? 'bg-primary text-white shadow-xs'
                          : answers[q.id]
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit confirmation modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Submit Exam?</h3>
              <p className="text-sm text-slate-500 text-center mb-2">
                You have answered <span className="font-semibold text-slate-700">{answeredCount}</span> of{' '}
                <span className="font-semibold text-slate-700">{questions.length}</span> questions.
              </p>
              {answeredCount < questions.length && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-center mb-4">
                  {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} left unanswered.
                </p>
              )}
              <p className="text-xs text-slate-400 text-center mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowSubmitConfirm(false)}>
                  Go Back
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={gradeAndSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    'Submit Now'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Failed submission popup */}
        {failedSubmissionModal}
      </div>
    </ExamSecurityGuard>
  );
}

  return null;
}
