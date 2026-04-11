'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Question } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttemptAnswerBreakdown, AnswerWithQuestion } from '@/components/AttemptAnswerBreakdown';
import { BarChart3, Clock, Loader2, Lock } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface AttemptRow {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string | null;
  submitted_at: string | null;
  score: number | null;
  total_points: number | null;
  is_graded: boolean;
  created_at: string | null;
  exams: { id: string; title: string; end_time: string | null } | null;
}

export default function StudentResultsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState<AttemptRow | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<Question[]>([]);
  const [detailAnswers, setDetailAnswers] = useState<AnswerWithQuestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('exam_attempts')
      .select('*, exams(id, title, end_time)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    setAttempts((data || []) as AttemptRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/'); return; }
      if (profile && profile.role !== 'student') { router.push('/teacher/dashboard'); return; }
      if (profile) fetchData();
    }
  }, [user, profile, authLoading, fetchData, router]);

  const isExamOngoing = (attempt: AttemptRow) => {
    const endTime = attempt.exams?.end_time;
    if (!endTime) return false;
    return new Date(endTime) > new Date();
  };

  const openDetails = useCallback(async (attempt: AttemptRow) => {
    if (isExamOngoing(attempt)) return;

    setDetailAttempt(attempt);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailQuestions([]);
    setDetailAnswers([]);

    const [qRes, aRes] = await Promise.all([
      supabase.from('questions').select('*').eq('exam_id', attempt.exam_id).order('order_index'),
      supabase.from('student_answers').select('*, questions(*)').eq('attempt_id', attempt.id),
    ]);

    setDetailQuestions(qRes.data || []);
    setDetailAnswers((aRes.data || []) as AnswerWithQuestion[]);
    setDetailLoading(false);
  }, []);

  const onDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailAttempt(null);
      setDetailQuestions([]);
      setDetailAnswers([]);
    }
  };

  const getGrade = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 90) return { label: 'A+', color: 'text-emerald-700 bg-emerald-50' };
    if (pct >= 80) return { label: 'A',  color: 'text-emerald-600 bg-emerald-50' };
    if (pct >= 70) return { label: 'B',  color: 'text-sky-800 bg-sky-500/10' };
    if (pct >= 60) return { label: 'C',  color: 'text-amber-700 bg-amber-50' };
    if (pct >= 50) return { label: 'D',  color: 'text-orange-700 bg-orange-50' };
    return             { label: 'F',  color: 'text-red-700 bg-red-50' };
  };

  if (authLoading || loading) {
    return (
     <DashboardLayout role="student">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
     </DashboardLayout>
    );
  }

  const detailPct =
    detailAttempt?.total_points && detailAttempt.is_graded
      ? Math.round(((detailAttempt.score || 0) / detailAttempt.total_points) * 100)
      : null;
  const detailGrade =
    detailAttempt?.is_graded && detailAttempt.total_points
      ? getGrade(detailAttempt.score || 0, detailAttempt.total_points)
      : null;

  return (
    <DashboardLayout role="student">
      <div className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto">

          {attempts.length === 0 ? (
            <div className="border border-border bg-card p-12 text-center">
              <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">No attempts yet.</p>
            </div>
          ) : (
            <>
              {/* ── Mobile cards (hidden on md+) ── */}
              <div className="flex flex-col divide-y divide-border rounded-lg p-1 d-border border-border bg-card md:hidden">
                {attempts.map((attempt) => {
                  const ongoing = isExamOngoing(attempt);
                  const pct = attempt.total_points
                    ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
                    : 0;
                  const grade =
                    attempt.is_graded && attempt.total_points
                      ? getGrade(attempt.score || 0, attempt.total_points)
                      : null;
                  const submittedAt = attempt.submitted_at
                    ? new Date(attempt.submitted_at).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <div key={attempt.id} className="p-4 space-y-3">
                      {/* Title + status badge */}
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium text-foreground leading-snug">
                          {attempt.exams?.title ?? 'Untitled Exam'}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                            ongoing
                              ? 'bg-violet-50 text-violet-700'
                              : attempt.is_graded
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {ongoing ? 'Result pending' : attempt.is_graded ? 'Graded' : 'Active'}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Submitted
                          </span>
                          <span className="text-sm text-foreground/90">{submittedAt}</span>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Score
                          </span>
                          {ongoing ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : attempt.is_graded ? (
                            <span className="text-sm font-semibold text-foreground">
                              {attempt.score}/{attempt.total_points}{' '}
                              <span className="font-normal text-muted-foreground">({pct}%)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Awaiting grade
                            </span>
                          )}
                        </div>

                        {!ongoing && grade && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Grade
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit ${grade.color}`}>
                              {grade.label}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      {!ongoing && attempt.is_graded && (
                        <div className="pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-0 text-primary hover:bg-transparent hover:underline"
                            onClick={() => openDetails(attempt)}
                          >
                            View details →
                          </Button>
                        </div>
                      )}
                      {ongoing && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Locked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop table (hidden below md) ── */}
              <div className="hidden md:block overflow-hidden border border-border bg-card">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exam</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grade</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attempts.map((attempt) => {
                      const ongoing = isExamOngoing(attempt);
                      const pct = attempt.total_points
                        ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
                        : 0;
                      const grade =
                        attempt.is_graded && attempt.total_points
                          ? getGrade(attempt.score || 0, attempt.total_points)
                          : null;
                      const submittedAt = attempt.submitted_at
                        ? new Date(attempt.submitted_at).toLocaleDateString(undefined, {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—';

                      return (
                        <tr key={attempt.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {attempt.exams?.title ?? 'Untitled Exam'}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/90">{submittedAt}</td>
                          <td className="px-4 py-3 text-center">
                            {ongoing ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : attempt.is_graded ? (
                              <span className="text-sm font-semibold text-foreground">
                                {attempt.score}/{attempt.total_points}{' '}
                                <span className="font-normal text-muted-foreground">({pct}%)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Awaiting grade
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!ongoing && grade ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${grade.color}`}>
                                {grade.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                ongoing
                                  ? 'bg-violet-50 text-violet-700'
                                  : attempt.is_graded
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {ongoing ? 'Result pending' : attempt.is_graded ? 'Graded' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!ongoing && attempt.is_graded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-primary hover:bg-primary/10"
                                onClick={() => openDetails(attempt)}
                              >
                                View details
                              </Button>
                            )}
                            {ongoing && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground pr-2">
                                <Lock className="h-3 w-3" />
                                Locked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={onDetailOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-4 pb-4 pt-5 sm:px-6 sm:pt-6 text-left">
            <DialogTitle className="pr-8 text-base sm:text-lg">
              {detailAttempt?.exams?.title ?? 'Exam'}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 pt-2 text-foreground/90" aria-live="polite">
              {detailLoading ? (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading attempt…
                </span>
              ) : detailAttempt?.is_graded ? (
                <>
                  <span className="text-sm font-semibold">
                    Score: {detailAttempt.score}/{detailAttempt.total_points}
                    {detailPct !== null && (
                      <span className="text-slate-500 font-normal"> ({detailPct}%)</span>
                    )}
                  </span>
                  {detailGrade && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${detailGrade.color}`}>
                      {detailGrade.label}
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-amber-800">
                  <Clock className="h-4 w-4" />
                  In progress — answers may be incomplete.
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="px-4 py-4 sm:px-6 overflow-y-auto flex-1 min-h-0">
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : detailQuestions.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No questions.</p>
            ) : (
              <AttemptAnswerBreakdown questions={detailQuestions} answers={detailAnswers} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}