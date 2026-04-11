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


  const openDetails = useCallback(async (attempt: AttemptRow) => {
    setDetailAttempt(attempt);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailQuestions([]);

    const [qRes, aRes] = await Promise.all([
      supabase.from('questions').select('*').eq('exam_id', attempt.exam_id).order('order_index'),
      supabase.from('student_answers').select('*, questions(*)').eq('attempt_id', attempt.id),
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
              <div className="flex flex-col divide-y divide-border rounded-lg p-1 border border-border bg-card md:hidden">
                {attempts.map((attempt) => {
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
                            className="h-8 px-0 text-primary hover:bg-transparent hover:underline"
                            onClick={() => router.push(`/student/exams/${attempt.id}`)}
                          >
                            View details →
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
                                View details
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