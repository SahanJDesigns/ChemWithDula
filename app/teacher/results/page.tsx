'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { neonClient as neon } from '@/lib/neon';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt } from '@/lib/types';
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
import { BarChart3, Clock, Users, RotateCcw, CheckCircle2, X } from 'lucide-react';

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
  const [recalculating, setRecalculating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRecalculate = async () => {
    if (recalculating || exams.length === 0) return;
    setRecalculating(true);
    try {
      const targets = examFilter !== 'all' ? [examFilter] : exams.map((e) => e.id);
      let totalAffected = 0;
      for (const eId of targets) {
        const res = await fetch(`/api/exams/${eId}/regrade`, { method: 'POST' });
        const json = await res.json();
        if (json.success && json.result?.affectedAttempts) {
          totalAffected += json.result.affectedAttempts;
        }
      }
      setToastMessage(`Marks successfully recalculated for ${totalAffected} student attempt(s).`);
      await fetchData();
    } catch (err) {
      console.error('Recalculate error:', err);
      alert('Failed to recalculate marks.');
    } finally {
      setRecalculating(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    const { data: examsData } = await neon
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

    const { data: attemptsData } = await neon
      .from('exam_attempts')
      .select('*, profiles(full_name)')
      .in('exam_id', examIds)
      .order('created_at', { ascending: false });

    setAttempts((attemptsData || []) as AttemptRow[]);
    setLoading(false);
  }, [user?.id]);

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

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
      <div className="min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Results</h1>
              <p className="mt-1 text-sm text-muted-foreground">Attempts · filter · details</p>
            </div>
            {exams.length > 0 && attempts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                disabled={recalculating}
                className="gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold self-start sm:self-auto"
                title="Force recalculate marks for all student attempts"
              >
                <RotateCcw className={`h-4 w-4 ${recalculating ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
                <span>{recalculating ? 'Recalculating...' : 'Recalculate Marks'}</span>
              </Button>
            )}
          </div>

          {toastMessage && (
            <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 flex items-center justify-between gap-3 text-sm text-emerald-950 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="font-semibold">{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

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
                                onClick={() => router.push(`/teacher/results/${attempt.id}`)}
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
  );
}
