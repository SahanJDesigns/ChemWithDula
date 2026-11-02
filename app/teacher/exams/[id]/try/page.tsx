'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { neonClient as neon } from '@/lib/neon';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, Question } from '@/lib/types';
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
  CircleX as XCircle,
  TriangleAlert as AlertTriangle,
  Trophy,
  Clock,
  BookOpen,
  FileText,
  Rows,
  Layers,
  X,
  ChevronUp,
  RotateCcw,
  ShieldCheck,
  Calendar,
  ArrowRight,
  Eye,
  Settings,
  Sparkles,
  Award,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ExamSecurityGuard from '@/components/ExamSecurityGuard';

type Phase = 'loading' | 'preview' | 'active' | 'review';

export default function TeacherTryExamPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<(Exam & { pdf_url?: string | null; option_count?: number }) | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, McqOptionLetter>>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);

  const storageKey = `teacher_try_exam_${examId}`;

  // ── Load Exam Data ────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [examRes, questionsRes] = await Promise.all([
        neon.from('exams').select('*').eq('id', examId).maybeSingle(),
        neon.from('questions').select('*').eq('exam_id', examId).order('order_index'),
      ]);

      if (!examRes.data) {
        router.push('/teacher/dashboard');
        return;
      }

      setExam(examRes.data);
      const qList: Question[] = questionsRes.data || [];
      setQuestions(qList);

      // Check for saved trial attempt in sessionStorage
      if (typeof window !== 'undefined') {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.phase && parsed.phase !== 'loading') {
              setPhase(parsed.phase);
              setAnswers(parsed.answers || {});
              setStartedAt(parsed.startedAt || null);
              setSubmittedAt(parsed.submittedAt || null);
              setScore(parsed.score || 0);
              setTotalPoints(parsed.totalPoints || 0);
              return;
            }
          } catch (e) {
            console.error('Failed to parse saved trial session:', e);
          }
        }
      }

      setPhase('preview');
    } catch (err) {
      console.error('Failed to load exam:', err);
      router.push('/teacher/dashboard');
    }
  }, [examId, user, router, storageKey]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
        return;
      }
      if (profile && profile.role !== 'teacher') {
        router.push(`/student/exams/${examId}`);
        return;
      }
      if (profile) {
        loadData();
      }
    }
  }, [user, profile, authLoading, loadData, router, examId]);

  // Persist active trial session
  const persistSession = (newPhase: Phase, newAnswers: Record<string, McqOptionLetter>, sAt: string | null, subAt: string | null, sc: number, tp: number) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          phase: newPhase,
          answers: newAnswers,
          startedAt: sAt,
          submittedAt: subAt,
          score: sc,
          totalPoints: tp,
        })
      );
    } catch (e) {}
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const startExam = () => {
    const nowIso = new Date().toISOString();
    setStartedAt(nowIso);
    setPhase('active');
    submitRef.current = false;
    persistSession('active', answers, nowIso, null, 0, 0);
  };

  const resetExam = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(storageKey);
    }
    setAnswers({});
    setStartedAt(null);
    setSubmittedAt(null);
    setScore(0);
    setTotalPoints(0);
    setCurrentQ(0);
    submitRef.current = false;
    setShowSubmitConfirm(false);
    setPhase('preview');
  };

  const saveAnswer = useCallback((questionId: string, option: McqOptionLetter) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: option };
      persistSession('active', next, startedAt, null, 0, 0);
      return next;
    });
  }, [startedAt]);

  const clearAnswer = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      persistSession('active', next, startedAt, null, 0, 0);
      return next;
    });
  }, [startedAt]);

  const gradeAndSubmit = useCallback(() => {
    if (submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    let earned = 0;
    const total = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    questions.forEach((q) => {
      const selected = answers[q.id];
      if (selected && selected === q.correct_option) {
        earned += (q.points || 1);
      }
    });

    const nowIso = new Date().toISOString();
    setScore(earned);
    setTotalPoints(total);
    setSubmittedAt(nowIso);
    setPhase('review');
    setSubmitting(false);

    persistSession('review', answers, startedAt, nowIso, earned, total);
  }, [questions, answers, startedAt]);

  const handleTimeUp = useCallback(() => {
    gradeAndSubmit();
  }, [gradeAndSubmit]);

  if (phase === 'loading' || authLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!exam) return null;

  const answeredCount = Object.keys(answers).length;
  const isPdfExam = Boolean(exam.pdf_url);
  const optionCount = exam.option_count || 5;

  // ──────────────────────────────────────────────────────────────────────────
  // TEACHER TRIAL HEADER BANNER (Top indicator in all phases)
  // ──────────────────────────────────────────────────────────────────────────
  const trialBanner = (
    <div className="bg-amber-500/10 border-b border-amber-300 text-amber-950 px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-xs uppercase tracking-wider">
          <Sparkles className="h-3 w-3" />
          Teacher Trial Mode
        </span>
        <span className="hidden md:inline text-amber-900">
          You are trying this exam exactly as a student. This trial does not affect student analytics.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={resetExam}
          className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-50 text-amber-900"
          title="Reset your answers and restart trial"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset Trial
        </Button>
        <Button
          variant="outline"
          size="sm"
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
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 1. PREVIEW PHASE
  // ──────────────────────────────────────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <DashboardLayout role="teacher">
        {trialBanner}
        <div className="min-h-[calc(100vh-6.5rem)] bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-3">
                {isPdfExam ? (
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                )}
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
              </div>

              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-left mb-6">
                <div className="flex gap-2.5">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900">
                    <p className="font-semibold text-emerald-950 mb-1">Teacher Simulation Information:</p>
                    <ul className="space-y-1 text-emerald-800">
                      <li>&bull; Test questions, images, options, and timer in live student view.</li>
                      <li>&bull; Instant grading and complete solution key shown immediately on submit.</li>
                      <li>&bull; Retry as many times as you like without corrupting student records.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {questions.length === 0 ? (
                <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-xs text-amber-800">
                  This exam does not have any questions yet. Add questions first before trying it out.
                  <div className="mt-3">
                    <Button asChild size="sm">
                      <Link href={`/teacher/exams/${exam.id}`}>Add Questions</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={startExam}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-semibold shadow-sm"
                >
                  <PlayCircle className="h-5 w-5 mr-2" />
                  Start Exam (Try as Student)
                </Button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. REVIEW PHASE (POST-SUBMISSION)
  // ──────────────────────────────────────────────────────────────────────────
  if (phase === 'review') {
    const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const getGrade = (p: number) => {
      if (p >= 75) return { label: 'A', color: 'text-emerald-600' };
      if (p >= 65) return { label: 'B', color: 'text-emerald-600' };
      if (p >= 55) return { label: 'C', color: 'text-primary' };
      if (p >= 35) return { label: 'S', color: 'text-amber-600' };
      return { label: 'W', color: 'text-red-600' };
    };
    const grade = getGrade(pct);

    let correctCount = 0;
    let incorrectCount = 0;
    questions.forEach((q) => {
      const ans = answers[q.id];
      if (ans) {
        if (ans === q.correct_option) correctCount++;
        else incorrectCount++;
      }
    });
    const unansweredCount = questions.length - answeredCount;

    return (
      <DashboardLayout role="teacher">
        {trialBanner}
        <div className="min-h-[calc(100vh-6.5rem)] bg-slate-50 py-6 px-4 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Score Summary Card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Trial Exam Completed
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Immediate Results Unlocked
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{exam.title}</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Submitted: {submittedAt ? new Date(submittedAt).toLocaleString() : 'Just now'} &bull; Teacher Trial Run
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/80">
                  <div className="text-center pr-3 border-r border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">
                      {score} / {totalPoints}
                    </p>
                  </div>
                  <div className="text-center pr-3 border-r border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</p>
                    <p className={`text-xl sm:text-2xl font-black ${grade.color}`}>
                      {grade.label} <span className="text-xs font-normal text-slate-500">({pct}%)</span>
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Correct</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-600">
                      {correctCount} <span className="text-xs font-normal text-slate-500">/ {questions.length}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons row */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Breakdown:</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">{correctCount} Correct</span>
                  <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-medium">{incorrectCount} Incorrect</span>
                  {unansweredCount > 0 && (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">{unansweredCount} Unanswered</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetExam}
                    className="h-8 text-xs font-semibold"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Try Again
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="h-8 text-xs font-semibold"
                  >
                    <Link href={`/teacher/exams/${exam.id}`}>
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back to Editor
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="h-8 text-xs font-semibold"
                  >
                    <Link href={`/teacher/results?exam=${exam.id}`}>
                      View Student Results
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Unlocked Solution Display */}
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
                      {score} / {totalPoints}
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
                  const selected = answers[q.id];
                  const isCorrect = selected === q.correct_option;
                  const isAnswered = Boolean(selected);

                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-5 ${
                        isCorrect
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : isAnswered
                            ? 'border-red-200 bg-red-50/30'
                            : 'border-amber-200 bg-amber-50/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : isAnswered ? (
                          <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              Question {idx + 1} &bull; {q.points} pt{q.points !== 1 ? 's' : ''}
                            </p>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                isCorrect
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isAnswered
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isCorrect ? `+${q.points} pts` : `0 / ${q.points} pts`}
                            </span>
                          </div>

                          {q.image_url && (
                            <div className="mb-3 max-w-lg">
                              <Image
                                src={q.image_url}
                                alt={`Question ${idx + 1}`}
                                width={0}
                                height={140}
                                className="rounded-lg border border-slate-200 w-full h-auto object-contain"
                              />
                            </div>
                          )}

                          {q.question_text && (
                            <p className="text-sm font-medium text-slate-800 mb-3">{q.question_text}</p>
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
                                      <span className="text-xs font-bold text-emerald-600">Correct Answer</span>
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
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ACTIVE EXAM PHASE
  // ──────────────────────────────────────────────────────────────────────────
  const question = questions[currentQ];

  /* ── SCENARIO A: PDF EXAM PAPER + RIGHT BUBBLE SHEET ── */
  if (isPdfExam) {
    return (
      <ExamSecurityGuard
        isActive={true}
        studentName={`${profile?.full_name || 'Teacher'} (Trial Mode)`}
        studentEmail={user?.email || ''}
        examTitle={exam.title}
      >
        <div className="bg-slate-900 min-h-screen flex flex-col">
          {trialBanner}

          {/* Top Header */}
          <div className="sticky top-11 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 flex items-center justify-between h-14 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                <h2 className="font-semibold text-sm truncate max-w-[160px] sm:max-w-xs md:max-w-md">
                  {exam.title}
                </h2>
                <span className="hidden sm:inline-block text-xs bg-slate-800 text-emerald-300 px-2 py-0.5 rounded-full font-medium border border-slate-700">
                  {answeredCount}/{questions.length} answered
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {startedAt && (
                  <ExamTimer
                    startedAt={startedAt}
                    durationMinutes={exam.duration_minutes}
                    onTimeUp={handleTimeUp}
                  />
                )}

                {/* Mobile Drawer Trigger */}
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

            {/* Progress Bar */}
            <div className="h-1 bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Main Area: Split Screen */}
          <div className="flex-1 mx-auto w-full max-w-7xl p-3 sm:p-4 flex flex-col lg:flex-row gap-4 overflow-hidden">
            {/* Left: Non-Downloadable Protected PDF Viewer */}
            <div className="flex-1 min-w-0 h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-7.5rem)]">
              <NonDownloadablePdfViewer
                pdfUrl={exam.pdf_url!}
                title={exam.title}
                className="h-full w-full"
              />
            </div>

            {/* Right: Answer Sheet (OMR Bubble Dots) - Desktop Sidebar */}
            <div className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col bg-white rounded-xl border border-slate-700 shadow-xl overflow-hidden h-[calc(100vh-7.5rem)]">
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

          {/* Mobile Bottom Floating Bar */}
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
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Submit Trial Exam?</h3>
                <p className="text-sm text-slate-500 text-center mb-2">
                  You have answered <span className="font-semibold text-slate-700">{answeredCount}</span> of{' '}
                  <span className="font-semibold text-slate-700">{questions.length}</span> questions.
                </p>
                {answeredCount < questions.length && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-center mb-4">
                    {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} left unanswered.
                  </p>
                )}
                <p className="text-xs text-slate-400 text-center mb-6">
                  You will see your score, grade, and the complete answer key immediately.
                </p>
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
        </div>
      </ExamSecurityGuard>
    );
  }

  /* ── SCENARIO B: QUESTION CARDS (MCQ) ── */
  return (
    <ExamSecurityGuard
      isActive={true}
      studentName={`${profile?.full_name || 'Teacher'} (Trial Mode)`}
      studentEmail={user?.email || ''}
      examTitle={exam.title}
    >
      <div className="bg-slate-50 min-h-screen">
        {trialBanner}

        {/* Top Header Bar */}
        <div className="sticky top-11 z-40 bg-white border-b border-slate-200 shadow-sm">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-semibold text-slate-900 text-sm truncate">{exam.title}</h2>
              <span className="text-xs text-slate-400 shrink-0">
                {answeredCount}/{questions.length} answered
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {startedAt && (
                <ExamTimer
                  startedAt={startedAt}
                  durationMinutes={exam.duration_minutes}
                  onTimeUp={handleTimeUp}
                />
              )}
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
              style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Question Panel */}
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
                          onClick={() => saveAnswer(question.id, opt)}
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
              <div className="rounded-xl border border-slate-200 bg-white p-4 sticky top-28">
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
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Submit Trial Exam?</h3>
              <p className="text-sm text-slate-500 text-center mb-2">
                You have answered <span className="font-semibold text-slate-700">{answeredCount}</span> of{' '}
                <span className="font-semibold text-slate-700">{questions.length}</span> questions.
              </p>
              {answeredCount < questions.length && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-center mb-4">
                  {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} left unanswered.
                </p>
              )}
              <p className="text-xs text-slate-400 text-center mb-6">
                You will see your score, grade, and full solutions immediately.
              </p>
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
      </div>
    </ExamSecurityGuard>
  );
}

