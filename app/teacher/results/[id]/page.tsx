'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt, Question, StudentAnswer } from '@/lib/types';
import {
  MCQ_OPTION_KEYS,
  MCQ_OPTION_LABELS,
  MCQ_OPTION_VALUES,
  type McqOptionLetter,
} from '@/lib/mcq-options';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CircleCheck as CheckCircle2, Circle as XCircle, Loader2 } from 'lucide-react';

type AttemptRow = ExamAttempt & {
  profiles: { full_name: string } | null;
  exams: Exam | null;
};

export default function TeacherAttemptDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const attemptId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, StudentAnswer>>({});

  const load = useCallback(async () => {
    if (!user?.id) return;

    const { data: row, error } = await supabase
      .from('exam_attempts')
      .select('*, profiles(full_name), exams(*)')
      .eq('id', attemptId)
      .maybeSingle();

    if (error || !row) {
      router.replace('/teacher/results');
      return;
    }

    const att = row as AttemptRow;
    const exam = att.exams;
    if (!exam || exam.teacher_id !== user.id) {
      router.replace('/teacher/results');
      return;
    }

    setAttempt(att);

    const [qRes, ansRes] = await Promise.all([
      supabase.from('questions').select('*').eq('exam_id', att.exam_id).order('order_index'),
      supabase.from('student_answers').select('*').eq('attempt_id', att.id),
    ]);

    setQuestions(qRes.data || []);
    const ansMap: Record<string, StudentAnswer> = {};
    (ansRes.data || []).forEach((a) => {
      ansMap[a.question_id] = a;
    });
    setSavedAnswers(ansMap);
    setLoading(false);
  }, [attemptId, user?.id, router]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
        return;
      }
      if (profile && profile.role !== 'teacher') {
        router.push('/student/dashboard');
        return;
      }
      if (profile) load();
    }
  }, [user, profile, authLoading, load, router]);

  const getGrade = (p: number) => {
    if (p >= 75) return { label: 'A', color: 'text-emerald-600' };
    if (p >= 65) return { label: 'B', color: 'text-emerald-600' };
    if (p >= 55) return { label: 'C', color: 'text-primary' };
    if (p >= 35) return { label: 'S', color: 'text-amber-600' };
    return { label: 'W', color: 'text-red-600' };
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!attempt) return null;

  const pct = attempt.total_points
    ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
    : 0;
  const grade = attempt.is_graded && attempt.total_points ? getGrade(pct) : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 h-9 gap-1.5 text-muted-foreground" asChild>
            <Link href="/teacher/results">
              <ArrowLeft className="h-4 w-4" />
              Back to results
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-slate-900">Attempt details</h1>
          <p className="mt-1 text-sm text-slate-600">
            {attempt.profiles?.full_name ?? 'Unknown student'}
            {attempt.exams?.title ? ` · ${attempt.exams.title}` : ''}
          </p>
        </div>

        <h2 className="mb-4 text-base font-semibold text-slate-900">Answer review</h2>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Score: {attempt.is_graded ? `${attempt.score} / ${attempt.total_points}` : '—'}
            </h2>
            {grade ? (
              <p className={`mt-1 text-base font-semibold sm:text-lg ${grade.color}`}>
                Grade: {grade.label} ({pct}%)
              </p>
            ) : (
              <p className="mt-1 text-sm text-amber-700">Not graded yet</p>
            )}
          </div>
          <div className="my-4 border-t border-slate-100" />
          <div className="grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <span className="font-medium text-slate-800">Status:</span>{' '}
              {attempt.is_graded ? 'Graded' : 'Active / pending'}
            </div>
            <div>
              <span className="font-medium text-slate-800">Started:</span>{' '}
              {attempt.started_at ? new Date(attempt.started_at).toLocaleString() : '—'}
            </div>
            <div>
              <span className="font-medium text-slate-800">Submitted:</span>{' '}
              {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '—'}
            </div>
            <div>
              <span className="font-medium text-slate-800">Duration:</span>{' '}
              {attempt.submitted_at && attempt.started_at
                ? `${Math.floor(
                    (new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) /
                      60000
                  )} mins`
                : '—'}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const ans = savedAnswers[q.id];
            const selected = ans?.selected_option as McqOptionLetter | undefined;
            const isCorrect = ans?.is_correct ?? (selected ? selected === q.correct_option : false);
            return (
              <div
                key={q.id}
                className={`rounded-xl border p-5 ${
                  !selected
                    ? 'border-slate-200 bg-slate-50/50'
                    : isCorrect
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-red-200 bg-red-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {selected ? (
                    isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    )
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Question {idx + 1} · {q.points} pt{q.points !== 1 ? 's' : ''}
                    </p>
                    {q.image_url && (
                      <Image
                        src={q.image_url}
                        alt="Question"
                        width={0}
                        height={140}
                        className="mb-3 h-auto w-full rounded-lg border border-slate-200 object-contain"
                      />
                    )}
                    {q.question_text && (
                      <p className="mb-3 text-sm font-medium text-slate-800">{q.question_text}</p>
                    )}
                    <div className="space-y-1.5">
                      {MCQ_OPTION_VALUES.map((opt, i) => {
                        const optKey = MCQ_OPTION_KEYS[i];
                        const isCorrectOpt = q.correct_option === opt;
                        const isSelectedOpt = selected === opt;
                        return (
                          <div
                            key={opt}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                              isCorrectOpt && isSelectedOpt
                                ? 'bg-emerald-100 font-medium text-emerald-800'
                                : isCorrectOpt
                                  ? 'border border-emerald-200 bg-emerald-50 font-medium text-emerald-700'
                                  : isSelectedOpt
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-white/60 text-slate-500'
                            }`}
                          >
                            <span className="shrink-0 font-bold">{MCQ_OPTION_LABELS[opt]}.</span>
                            {q[optKey]}
                            {isCorrectOpt && (
                              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />
                            )}
                            {isSelectedOpt && !isCorrectOpt && (
                              <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-400" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {!selected && (
                      <p className="mt-2 text-xs italic text-slate-400">No answer selected</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
