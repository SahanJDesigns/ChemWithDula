'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt, Question } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttemptAnswerBreakdown, AnswerWithQuestion } from '@/components/AttemptAnswerBreakdown';
import { BarChart3, Clock, Loader2, Users } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface AttemptRow extends Omit<ExamAttempt, 'profiles'> {
  profiles: { full_name: string } | null;
}

export default function TeacherResultsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [studentFilter, setStudentFilter] = useState('');
  const [examFilter, setExamFilter] = useState<string>('all');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState<AttemptRow | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<Question[]>([]);
  const [detailAnswers, setDetailAnswers] = useState<AnswerWithQuestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    const { data: examsData } = await supabase
      .from('exams')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (!examsData || examsData.length === 0) {
      setExams([]);
      setAttempts([]);
      setLoading(false);
      return;
    }

    setExams(examsData);
    const examIds = examsData.map((e) => e.id);

    const { data: attemptsData } = await supabase
      .from('exam_attempts')
      .select('*, profiles(full_name)')
      .in('exam_id', examIds)
      .order('created_at', { ascending: false });

    setAttempts((attemptsData || []) as AttemptRow[]);
    setLoading(false);
  }, [user?.id]);

  const openAttemptDetails = useCallback(async (attempt: AttemptRow) => {
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
      if (profile) fetchData();
    }
  }, [user, profile, authLoading, fetchData, router]);

  const examById = useMemo(() => Object.fromEntries(exams.map((e) => [e.id, e])), [exams]);

  const filteredAttempts = useMemo(() => {
    const nameQ = studentFilter.trim().toLowerCase();
    return attempts.filter((a) => {
      const name = (a.profiles?.full_name || '').toLowerCase();
      if (examFilter !== 'all' && a.exam_id !== examFilter) return false;
      if (nameQ && !name.includes(nameQ)) return false;
      return true;
    });
  }, [attempts, studentFilter, examFilter]);

  const getGrade = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 90) return { label: 'A+', color: 'text-emerald-700 bg-emerald-50' };
    if (pct >= 80) return { label: 'A', color: 'text-emerald-600 bg-emerald-50' };
    if (pct >= 70) return { label: 'B', color: 'text-sky-800 bg-sky-500/10' };
    if (pct >= 60) return { label: 'C', color: 'text-amber-700 bg-amber-50' };
    if (pct >= 50) return { label: 'D', color: 'text-orange-700 bg-orange-50' };
    return { label: 'F', color: 'text-red-700 bg-red-50' };
  };

  const onDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailAttempt(null);
      setDetailQuestions([]);
      setDetailAnswers([]);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const detailExam = detailAttempt ? examById[detailAttempt.exam_id] : null;
  const detailPct =
    detailAttempt?.total_points && detailAttempt.is_graded
      ? Math.round(((detailAttempt.score || 0) / detailAttempt.total_points) * 100)
      : null;
  const detailGrade =
    detailAttempt?.is_graded && detailAttempt.total_points
      ? getGrade(detailAttempt.score || 0, detailAttempt.total_points)
      : null;

  return (
    <DashboardLayout role="teacher">
      <div className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Results</h1>
            <p className="mt-1 text-sm text-muted-foreground">Attempts · filter · details</p>
          </div>

          {exams.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">No exams yet.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="student-filter">Student name</Label>
                    <Input
                      id="student-filter"
                      placeholder="Filter by name…"
                      value={studentFilter}
                      onChange={(e) => setStudentFilter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exam</Label>
                    <Select value={examFilter} onValueChange={setExamFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All exams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All exams</SelectItem>
                        {exams.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {attempts.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center">
                  <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No attempts.</p>
                </div>
              ) : filteredAttempts.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
                  No matches.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Exam
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Score
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAttempts.map((attempt) => {
                        const exam = examById[attempt.exam_id];
                        const pct = attempt.total_points
                          ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
                          : 0;
                        return (
                          <tr key={attempt.id} className="transition-colors hover:bg-muted/40">
                            <td className="px-4 py-3 text-sm font-medium text-foreground">
                              {attempt.profiles?.full_name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground/90">{exam?.title ?? '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {attempt.is_graded ? (
                                <span className="text-sm font-semibold text-foreground">
                                  {attempt.score}/{attempt.total_points}{' '}
                                  <span className="font-normal text-muted-foreground">({pct}%)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  In progress
                                </span>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-primary hover:bg-primary/10"
                                onClick={() => openAttemptDetails(attempt)}
                              >
                                View details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={onDetailOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle className="pr-8">
              {detailAttempt?.profiles?.full_name || 'Student'}
              {detailExam && (
                <span className="mt-1 block text-sm font-normal text-muted-foreground">{detailExam.title}</span>
              )}
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
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${detailGrade.color}`}
                    >
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
          <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
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
