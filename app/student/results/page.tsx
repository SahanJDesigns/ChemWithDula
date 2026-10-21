'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { neonClient as neon } from '@/lib/neon';
import { useAuth } from '@/contexts/AuthContext';
import { Question } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BarChart3, Clock, Loader2, Lock, CheckCircle2, FileText } from 'lucide-react';
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
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await neon
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


  const openDetails = useCallback(async (attempt: AttemptRow) => {
    setDetailAttempt(attempt);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailQuestions([]);

    const [qRes, aRes] = await Promise.all([
      neon.from('questions').select('*').eq('exam_id', attempt.exam_id).order('order_index'),
      neon.from('student_answers').select('*, questions(*)').eq('attempt_id', attempt.id),
    ]);

    setDetailQuestions(qRes.data || []);
    setDetailLoading(false);
  }, []);

  const onDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailAttempt(null);
      setDetailQuestions([]);
    }
  };

   const getGrade = (p: number) => {
      if (p >= 75) return { label: 'A', color: 'text-emerald-600' };
      if (p >= 65) return { label: 'B', color: 'text-emerald-600' };
      if (p >= 55) return { label: 'C', color: 'text-primary' };
      if (p >= 35) return { label: 'S', color: 'text-amber-600' };
      return { label: 'W', color: 'text-red-600' };
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
              <div className="flex flex-col divide-y divide-border rounded-lg p-1 border border-border bg-card md:hidden">
                {attempts.map((attempt) => {
                  const pct = attempt.total_points
                    ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
                    : 0;
                  const grade =
                    attempt.is_graded && attempt.total_points
                      ? getGrade(attempt.score || 0)
                      : null;
                  const submittedAt = attempt.submitted_at
                    ? new Date(attempt.submitted_at).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';

                  const isPaperLocked = Boolean(
                    attempt.exams?.end_time && new Date(attempt.exams.end_time) > new Date()
                  );

                  return (
                    <div key={attempt.id} className="p-4 space-y-3">
                      {/* Title + status badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-sm font-medium text-foreground leading-snug block">
                            {attempt.exams?.title ?? 'Untitled Exam'}
                          </span>
                          {attempt.is_graded && (
                            <div className="mt-1">
                              {isPaperLocked ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <Lock className="h-3 w-3" />
                                  Paper preview locked until deadline
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Paper preview unlocked
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                            attempt.is_graded
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {attempt.is_graded ? 'Graded' : 'Active'}
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
                          {attempt.is_graded ? (
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
                      </div>

                      {/* Action */}
                      {attempt.is_graded && (
                        <div className="pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-0 text-primary hover:bg-transparent hover:underline flex items-center gap-1.5"
                            onClick={() => router.push(`/student/exams/${attempt.exam_id}`)}
                          >
                            {isPaperLocked ? (
                              <>
                                <Lock className="h-3.5 w-3.5" />
                                View Result (Paper locked) →
                              </>
                            ) : (
                              <>
                                <FileText className="h-3.5 w-3.5" />
                                View Paper & Results →
                              </>
                            )}
                          </Button>
                        </div>
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
                      const pct = attempt.total_points
                        ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
                        : 0;
                      const grade =
                        attempt.is_graded && attempt.total_points
                          ? getGrade(attempt.score || 0)
                          : null;
                      const submittedAt = attempt.submitted_at
                        ? new Date(attempt.submitted_at).toLocaleDateString(undefined, {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—';
                      const isPaperLocked = Boolean(
                        attempt.exams?.end_time && new Date(attempt.exams.end_time) > new Date()
                      );

                      return (
                        <tr key={attempt.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            <div>{attempt.exams?.title ?? 'Untitled Exam'}</div>
                            {attempt.is_graded && (
                              <div className="mt-0.5">
                                {isPaperLocked ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    <Lock className="h-2.5 w-2.5" />
                                    Paper locked until deadline
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Paper unlocked
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/90">{submittedAt}</td>
                          <td className="px-4 py-3 text-center">
                            {attempt.is_graded ? (
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
                            {grade ? (
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
                                  attempt.is_graded
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {attempt.is_graded ? 'Graded' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {attempt.is_graded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-primary hover:bg-primary/10"
                                onClick={() => router.push(`/student/exams/${attempt.exam_id}`)}
                              >
                                {isPaperLocked ? (
                                  <>
                                    <Lock className="h-3.5 w-3.5 mr-1" />
                                    View Result
                                  </>
                                ) : (
                                  <>
                                    <FileText className="h-3.5 w-3.5 mr-1" />
                                    View Paper
                                  </>
                                )}
                              </Button>
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
    </DashboardLayout>
  );
}