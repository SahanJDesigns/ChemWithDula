'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt } from '@/lib/types';
import { getStudentExamStatus, StudentExamStatus } from '@/lib/student-exam-status';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  PlayCircle,
  Sparkles,
  Timer,
  Trophy,
} from 'lucide-react';

interface ExamWithAttempt extends Exam {
  attempt?: ExamAttempt;
  questionCount: number;
}

const FILTER_ORDER: StudentExamStatus[] = [
  'available',
  'in_progress',
  'completed',
  'upcoming',
  'expired',
];

const FILTER_META: Record<StudentExamStatus, { short: string; hint: string }> = {
  available: { short: 'Open', hint: 'Ready to start.' },
  in_progress: { short: 'Active', hint: 'In progress.' },
  completed: { short: 'Done', hint: 'Graded.' },
  upcoming: { short: 'Soon', hint: 'Not open yet.' },
  expired: { short: 'Closed', hint: 'Past deadline.' },
};

export default function StudentMyExamsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StudentExamStatus | 'all'>('all');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
        return;
      }
      if (profile && profile.role !== 'student') {
        router.push('/teacher/dashboard');
        return;
      }
      if (profile) fetchExams();
    }
  }, [user, profile, authLoading, router]);

  const fetchExams = async () => {
    const [examsRes, attemptsRes] = await Promise.all([
      supabase.from('exams').select('*, questions(count)').eq('is_published', true).order('created_at', { ascending: false }),
      supabase.from('exam_attempts').select('*').eq('student_id', user!.id),
    ]);

    const attemptMap: Record<string, ExamAttempt> = {};
    (attemptsRes.data || []).forEach((a) => {
      attemptMap[a.exam_id] = a;
    });

    const enriched = (examsRes.data || []).map((exam) => ({
      ...exam,
      attempt: attemptMap[exam.id],
      questionCount: (exam as unknown as { questions: { count: number }[] }).questions?.[0]?.count ?? 0,
    }));

    setExams(enriched);
    setLoading(false);
  };

  const counts = useMemo(() => {
    const c: Record<StudentExamStatus, number> = {
      available: 0,
      in_progress: 0,
      completed: 0,
      upcoming: 0,
      expired: 0,
    };
    exams.forEach((e) => {
      c[getStudentExamStatus(e, e.attempt)]++;
    });
    return c;
  }, [exams]);

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      const s = getStudentExamStatus(exam, exam.attempt);
      if (filter === 'all') return true;
      return s === filter;
    });
  }, [exams, filter]);

  if (authLoading || loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="relative min-h-[calc(100vh-4rem)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <header className="mb-8 sm:mb-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Published exams
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">My exams</h1>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">Start, continue, or review.</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {counts.available + counts.in_progress}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    Done
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                    {counts.completed}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Filters */}
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'border border-border bg-card text-muted-foreground hover:border-muted-foreground/25'
              }`}
            >
              All
              <span className="ml-1 tabular-nums opacity-80">({exams.length})</span>
            </button>
            {FILTER_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'border border-border bg-card text-muted-foreground hover:border-muted-foreground/25'
                }`}
              >
                {FILTER_META[key].short}
                <span className="ml-1 tabular-nums opacity-80">({counts[key]})</span>
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 px-8 py-20 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No exams</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {filter === 'all'
                  ? 'Nothing published yet.'
                  : `No matches for “${FILTER_META[filter as StudentExamStatus].short}”.`}
              </p>
              {filter !== 'all' && (
                <Button variant="outline" className="mt-6" onClick={() => setFilter('all')}>
                  Show all exams
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((exam) => {
                const status = getStudentExamStatus(exam, exam.attempt);
                const meta = FILTER_META[status];
                const canStart = status === 'available';
                const canContinue = status === 'in_progress';
                const isCompleted = status === 'completed';

                const accent =
                  status === 'completed'
                    ? 'from-emerald-500 to-teal-500'
                    : status === 'in_progress'
                      ? 'from-primary to-teal-600'
                      : status === 'available'
                        ? 'from-primary to-cyan-600'
                        : status === 'upcoming'
                          ? 'from-amber-400 to-orange-500'
                          : 'from-muted-foreground to-muted-foreground/70';

                const Icon =
                  status === 'completed'
                    ? Trophy
                    : status === 'in_progress'
                      ? Timer
                      : status === 'available'
                        ? PlayCircle
                        : status === 'upcoming'
                          ? Calendar
                          : Clock;

                return (
                  <li key={exam.id}>
                    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                      <div
                        className={`h-1.5 w-full bg-gradient-to-r ${accent}`}
                        aria-hidden
                      />
                      <div className="flex flex-1 flex-col p-5 sm:p-6">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}
                          >
                            <Icon className="h-5 w-5" strokeWidth={2} />
                          </div>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {meta.short}
                          </span>
                        </div>

                        <h2 className="line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                          {exam.title}
                        </h2>
                        {exam.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
                        )}

                        <p className="mt-2 text-xs text-muted-foreground">{meta.hint}</p>

                        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            {exam.questionCount} Q
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {exam.duration_minutes} min
                          </span>
                        </div>

                        {isCompleted && exam.attempt && (
                          <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50/80 px-3 py-3 border border-emerald-100/80">
                            <div className="flex items-center justify-between text-xs font-medium text-emerald-800">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Result
                              </span>
                              <span className="tabular-nums">
                                {exam.attempt.score}/{exam.attempt.total_points} (
                                {Math.round(
                                  ((exam.attempt.score || 0) / (exam.attempt.total_points || 1)) * 100
                                )}
                                %)
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                style={{
                                  width: `${Math.round(
                                    ((exam.attempt.score || 0) / (exam.attempt.total_points || 1)) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-auto pt-5">
                          {(canStart || canContinue || isCompleted) && (
                            <Button
                              asChild
                              className={`w-full font-semibold ${
                                canStart || canContinue ? '' : 'bg-emerald-600 hover:bg-emerald-600/90'
                              }`}
                            >
                              <Link href={`/student/exams/${exam.id}`}>
                                {canStart && (
                                  <>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Start exam
                                  </>
                                )}
                                {canContinue && (
                                  <>
                                    <Timer className="mr-2 h-4 w-4" />
                                    Continue
                                  </>
                                )}
                                {isCompleted && (
                                  <>
                                    <Trophy className="mr-2 h-4 w-4" />
                                    View result
                                  </>
                                )}
                              </Link>
                            </Button>
                          )}
                          {(status === 'upcoming' || status === 'expired') && (
                            <div className="flex h-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-400">
                              {status === 'upcoming' ? 'Not open yet' : 'Closed'}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
