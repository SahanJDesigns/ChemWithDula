'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, Question, ExamAttempt, StudentAnswer } from '@/lib/types';
import { MCQ_OPTION_KEYS, MCQ_OPTION_LABELS, MCQ_OPTION_VALUES, type McqOptionLetter } from '@/lib/mcq-options';
import { Button } from '@/components/ui/button';
import ExamTimer from '@/components/ExamTimer';
import { ArrowLeft, CirclePlay as PlayCircle, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, Trophy, Clock, BookOpen } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

type Phase = 'loading' | 'preview' | 'active' | 'review';

export default function StudentExamPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, McqOptionLetter>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, StudentAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const submitRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [examRes, attemptRes] = await Promise.all([
      supabase.from('exams').select('*').eq('id', examId).maybeSingle(),
      supabase.from('exam_attempts').select('*').eq('exam_id', examId).eq('student_id', user.id).maybeSingle(),
    ]);

    if (!examRes.data) { router.push('/student/dashboard'); return; }
    setExam(examRes.data);

    const questionsRes = await supabase.from('questions').select('*').eq('exam_id', examId).order('order_index');
    setQuestions(questionsRes.data || []);

    if (attemptRes.data) {
      setAttempt(attemptRes.data);
      if (attemptRes.data.is_graded || attemptRes.data.submitted_at) {
        const answersRes = await supabase.from('student_answers').select('*').eq('attempt_id', attemptRes.data.id);
        const ansMap: Record<string, StudentAnswer> = {};
        (answersRes.data || []).forEach((a) => { ansMap[a.question_id] = a; });
        setSavedAnswers(ansMap);
        setPhase('review');
      } else {
        const answersRes = await supabase.from('student_answers').select('*').eq('attempt_id', attemptRes.data.id);
        const selMap: Record<string, McqOptionLetter> = {};
        (answersRes.data || []).forEach((a) => {
          if (a.selected_option) selMap[a.question_id] = a.selected_option as McqOptionLetter;
        });
        setAnswers(selMap);
        setPhase('active');
      }
    } else {
      setPhase('preview');
    }
  }, [examId, user, router]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/'); return; }
      if (profile && profile.role !== 'student') { router.push('/teacher/dashboard'); return; }
      if (profile) loadData();
    }
  }, [user, profile, authLoading, loadData, router]);

  const startExam = async () => {
    if (!user || !exam) return;
    const now = new Date();
    if (exam.start_time && new Date(exam.start_time) > now) { alert('This exam is not open yet.'); return; }
    if (exam.end_time && new Date(exam.end_time) < now) { alert('This exam has closed.'); return; }
    setStarting(true);
    const { data, error } = await supabase.from('exam_attempts').insert({
      exam_id: examId,
      student_id: user.id,
      started_at: new Date().toISOString(),
    }).select().single();
    if (error) { alert('Could not start exam. Please try again.'); setStarting(false); return; }
    setAttempt(data);
    setPhase('active');
    setStarting(false);
  };

  const saveAnswer = useCallback(async (questionId: string, option: McqOptionLetter) => {
    if (!attempt) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    await supabase.from('student_answers').upsert({
      attempt_id: attempt.id,
      question_id: questionId,
      selected_option: option,
    }, { onConflict: 'attempt_id,question_id' });
  }, [attempt]);

  const gradeAndSubmit = useCallback(async () => {
    if (!attempt || submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    const answersRes = await supabase.from('student_answers').select('*').eq('attempt_id', attempt.id);
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

    await supabase.from('student_answers').upsert(updates, { onConflict: 'attempt_id,question_id' });
    await supabase.from('exam_attempts').update({
      submitted_at: new Date().toISOString(),
      score,
      total_points: totalPoints,
      is_graded: true,
    }).eq('id', attempt.id);

    const finalAttempt = { ...attempt, submitted_at: new Date().toISOString(), score, total_points: totalPoints, is_graded: true };
    setAttempt(finalAttempt);

    const ansMap: Record<string, StudentAnswer> = {};
    updates.forEach((u) => { ansMap[u.question_id] = { ...u, id: '', created_at: '' }; });
    setSavedAnswers(ansMap);
    setPhase('review');
    setSubmitting(false);
  }, [attempt, questions, answers]);

  const handleTimeUp = useCallback(() => {
    gradeAndSubmit();
  }, [gradeAndSubmit]);

  if (phase === 'loading' || authLoading) {
    return (
      <DashboardLayout role="student">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
      </DashboardLayout>
    );
  }

  if (!exam) return null;

  /* PREVIEW */
  if (phase === 'preview') {
    const now = new Date();
    const isBeforeStart = exam.start_time && new Date(exam.start_time) > now;
    const isAfterEnd = exam.end_time && new Date(exam.end_time) < now;
    return (
      <DashboardLayout role="student">
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
        
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{exam.title}</h1>
            {exam.description && <p className="text-slate-500 mb-6 text-sm leading-relaxed">{exam.description}</p>}
            <div className="grid grid-cols-2 gap-3 mb-8 text-left">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Questions</p>
                <p className="text-xl font-bold text-slate-900">{questions.length}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Time Limit</p>
                <p className="text-xl font-bold text-slate-900">{exam.duration_minutes} min</p>
              </div>
              {exam.start_time && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 mb-1">Opens</p>
                  <p className="text-sm font-semibold text-slate-700">{new Date(exam.start_time).toLocaleString()}</p>
                </div>
              )}
              {exam.end_time && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 mb-1">Closes</p>
                  <p className="text-sm font-semibold text-slate-700">{new Date(exam.end_time).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-left mb-6">
              <div className="flex gap-2.5">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Before you begin:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Once started, the timer cannot be paused.</li>
                    <li>• You can only attempt this exam once.</li>
                    <li>• Your exam will be submitted automatically when time runs out.</li>
                  </ul>
                </div>
              </div>
            </div>
            {isBeforeStart ? (
              <p className="text-sm text-slate-500">This exam opens on {new Date(exam.start_time!).toLocaleString()}</p>
            ) : isAfterEnd ? (
              <p className="text-sm text-red-500">This exam has closed.</p>
            ) : (
              <Button
                onClick={startExam}
                disabled={starting}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-semibold"
              >
                {starting ? <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <><PlayCircle className="h-5 w-5 mr-2" />Start Exam</>}
              </Button>
            )}
          </div>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  /* REVIEW */
  if (phase === 'review' && attempt) {
    const pct = attempt.total_points ? Math.round(((attempt.score || 0) / attempt.total_points) * 100) : 0;
    const getGrade = (p: number) => {
      if (p >= 75) return { label: 'A', color: 'text-emerald-600' };
      if (p >= 65) return { label: 'B', color: 'text-emerald-600' };
      if (p >= 55) return { label: 'C', color: 'text-primary' };
      if (p >= 35) return { label: 'S', color: 'text-amber-600' };
      return { label: 'W', color: 'text-red-600' };
    };
    const grade = getGrade(pct);

    return (
      <DashboardLayout role="student">
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
        <div className="mx-auto px-4 sm:px-6 py-8">
       

          {/* Answers breakdown */}
          <h2 className="text-base font-semibold text-slate-900 mb-4">Answer Review</h2>
          <div className="space-y-4">
               {/* ResultSummary */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm text-center mb-8">
                
                 <div className=" mx-auto rounded-xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
  
              {/* Score Section */}
              <div className="text-center mb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Your Score: {attempt.score} / {attempt.total_points}
                </h1>
                <p className={`text-base sm:text-lg font-semibold ${grade.color}`}>
                  Grade: {grade.label}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 my-4" />

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
                
                <div>
                  <span className="font-medium text-slate-800">Status:</span>{" "}
                  {attempt.is_graded ? "Graded" : "Pending"}
                </div>

                <div>
                  <span className="font-medium text-slate-800">Started:</span>{" "}
                  {new Date(attempt.started_at).toLocaleString()}
                </div>

                <div>
                  <span className="font-medium text-slate-800">Submitted:</span>{" "}
                  { attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '—' }
                </div>

                <div>
                  <span className="font-medium text-slate-800">Duration:</span>{" "}
                  {Math.floor(
                    (attempt.submitted_at && attempt.started_at
                      ? (new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime())
                      : 0) / 60000
                  )} mins
                </div>

              </div>
            </div>
                </div>
            {questions.map((q, idx) => {
              const ans = savedAnswers[q.id];
              const isCorrect = ans?.is_correct;
              const selected = ans?.selected_option;
              return (
                <div key={q.id} className={`rounded-xl border p-5 ${isCorrect ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    {isCorrect
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      : <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Question {idx + 1} &bull; {q.points} pt{q.points !== 1 ? 's' : ''}</p>
                      {q.image_url && (
                          <Image
                            src={q.image_url}
                            alt="Question"
                            width={0}
                            height={140}
                            className="rounded-lg border border-slate-200 mb-3 w-full h-auto object-contain"
                          />                      )}
                      {q.question_text && <p className="text-sm font-medium text-slate-800 mb-3">{q.question_text}</p>}
                      <div className="space-y-1.5">
                        {MCQ_OPTION_VALUES.map((opt, i) => {
                          const optKey = MCQ_OPTION_KEYS[i];
                          const isCorrectOpt = q.correct_option === opt;
                          const isSelectedOpt = selected === opt;
                          return (
                            <div
                              key={opt}
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                                isCorrectOpt && isSelectedOpt ? 'bg-emerald-100 text-emerald-800 font-medium' :
                                isCorrectOpt ? 'bg-emerald-50 text-emerald-700 font-medium border border-emerald-200' :
                                isSelectedOpt ? 'bg-red-100 text-red-700' :
                                'bg-white/60 text-slate-500'
                              }`}
                            >
                              <span className="font-bold shrink-0">{MCQ_OPTION_LABELS[opt]}.</span>
                              {q[optKey]}
                              {isCorrectOpt && <CheckCircle2 className="h-4 w-4 ml-auto shrink-0 text-emerald-500" />}
                              {isSelectedOpt && !isCorrectOpt && <XCircle className="h-4 w-4 ml-auto shrink-0 text-red-400" />}
                            </div>
                          );
                        })}
                      </div>
                      {!selected && <p className="text-xs text-slate-400 mt-2 italic">No answer selected</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  /* ACTIVE EXAM */
  if (phase === 'active' && attempt) {
    const answeredCount = Object.keys(answers).length;
    const question = questions[currentQ];

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
        {/* Exam header bar */}
        <div className="sticky top-16 z-40 bg-white border-b border-slate-200 shadow-sm">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-semibold text-slate-900 text-sm truncate">{exam.title}</h2>
              <span className="text-xs text-slate-400 shrink-0">{answeredCount}/{questions.length} answered</span>
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
            <div className="h-full bg-primary transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="mx-auto px-4 sm:px-6 py-6">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Question panel */}
            <div className="lg:col-span-3">
              {question && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                    Question {currentQ + 1} of {questions.length} &bull; {question.points} pt{question.points !== 1 ? 's' : ''}
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
                    <p className="text-base font-medium text-slate-900 mb-6 leading-relaxed">{question.question_text}</p>
                  )}
                  <div className="space-y-3">
                    {MCQ_OPTION_VALUES.map((opt, i) => {
                      const optKey = MCQ_OPTION_KEYS[i];
                      const isSelected = answers[question.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => saveAnswer(question.id, opt)}
                          className={`w-full flex items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 text-left text-sm transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'border-primary bg-primary' : 'border-slate-300'
                          }`}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <span className={`font-semibold mr-0.5 ${isSelected ? 'text-primary' : 'text-slate-400'}`}>{MCQ_OPTION_LABELS[opt]}.</span>
                          <span>{question[optKey]}</span>
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
              <div className="rounded-xl border border-slate-200 bg-white p-4 sticky top-32">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Questions</p>
                <div className="grid grid-cols-5 gap-1.5 lg:grid-cols-4">
                  {questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQ(idx)}
                      className={`h-9 w-full rounded-lg text-xs font-bold transition-all ${
                        idx === currentQ
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : answers[q.id]
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Submit Exam?</h3>
              <p className="text-sm text-slate-500 text-center mb-2">
                You have answered <span className="font-semibold text-slate-700">{answeredCount}</span> of <span className="font-semibold text-slate-700">{questions.length}</span> questions.
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
                  {submitting ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : 'Submit Now'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
