'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Medal,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';

interface ResultRow {
  id: string;
  exam_id: string;
  score: number | null;
  total_points: number | null;
  submitted_at: string | null;
  examTitle: string;
}

function pct(score: number | null, total: number | null) {
  if (!total) return 0;
  return Math.round(((score || 0) / total) * 100);
}

function gradeLabel(p: number) {
  if (p >= 90) return { l: 'A+', className: 'text-primary bg-primary/10 border-primary/20' };
  if (p >= 80) return { l: 'A', className: 'text-emerald-800 bg-emerald-500/10 border-emerald-500/25' };
  if (p >= 70) return { l: 'B', className: 'text-sky-800 bg-sky-500/10 border-sky-500/25' };
  if (p >= 60) return { l: 'C', className: 'text-amber-800 bg-amber-500/10 border-amber-500/25' };
  if (p >= 50) return { l: 'D', className: 'text-orange-800 bg-orange-500/10 border-orange-500/25' };
  return { l: 'F', className: 'text-red-800 bg-red-500/10 border-red-500/25' };
}

function ScoreRing({ value, size = 88 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const stroke =
    value >= 80 ? 'stroke-emerald-500' : value >= 60 ? 'stroke-primary' : 'stroke-amber-500';

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-muted"
        strokeWidth="6"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
    </svg>
  );
}

export default function StudentResultsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
      if (profile) fetchResults();
    }
  }, [user, profile, authLoading, router]);

  const fetchResults = async () => {
    const { data: attempts, error } = await supabase
      .from('exam_attempts')
      .select('id, exam_id, score, total_points, submitted_at, is_graded')
      .eq('student_id', user!.id)
      .eq('is_graded', true)
      .order('submitted_at', { ascending: false });

    if (error || !attempts?.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const examIds = [...new Set(attempts.map((a) => a.exam_id))];
    const { data: examsData } = await supabase.from('exams').select('id, title').in('id', examIds);
    const titleMap = Object.fromEntries((examsData || []).map((e) => [e.id, e.title]));

    setRows(
      attempts.map((a) => ({
        id: a.id,
        exam_id: a.exam_id,
        score: a.score,
        total_points: a.total_points,
        submitted_at: a.submitted_at,
        examTitle: titleMap[a.exam_id] || 'Exam',
      }))
    );
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.examTitle.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => {
    if (rows.length === 0) return { avg: 0, best: 0, count: 0 };
    const pcts = rows.map((r) => pct(r.score, r.total_points));
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const best = Math.max(...pcts);
    return { avg, best, count: rows.length };
  }, [rows]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="relative min-h-[calc(100vh-4rem)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <header className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Graded only
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Results</h1>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Search by exam name. Open a row for review.</p>
          </header>

          {rows.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No results</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Submit an exam to see scores here.</p>
              <Button asChild className="mt-6">
                <Link href="/student/exams">My exams</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Stats strip */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Avg
                  </div>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{stats.avg}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stats.count} exam{stats.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Medal className="h-4 w-4 text-amber-500" />
                    Best
                  </div>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{stats.best}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">High</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Trophy className="h-4 w-4 text-emerald-600" />
                    Done
                  </div>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{stats.count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total</p>
                </div>
              </div>

              {/* Search */}
              <div className="mb-8 max-w-md">
                <Label htmlFor="result-search" className="sr-only">
                  Filter by exam name
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="result-search"
                    placeholder="Search exams…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 rounded-xl pl-10 shadow-sm"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No match for “{search.trim()}”.</p>
              ) : (
                <ul className="space-y-4">
                  {filtered.map((r) => {
                    const p = pct(r.score, r.total_points);
                    const g = gradeLabel(p);
                    const date = r.submitted_at
                      ? new Date(r.submitted_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '';

                    return (
                      <li key={r.id}>
                        <div className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md sm:flex-row sm:items-center sm:p-5">
                          <div className="relative flex items-center gap-4 sm:gap-5">
                            <div className="relative h-[88px] w-[88px] shrink-0">
                              <ScoreRing value={p} />
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-foreground">
                                {p}%
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h2 className="line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                                {r.examTitle}
                              </h2>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {date}
                                </span>
                                <span className="tabular-nums">
                                  Score {r.score}/{r.total_points}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${g.className}`}
                                >
                                  {g.l}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button asChild variant="outline" className="shrink-0 sm:ml-auto">
                            <Link href={`/student/exams/${r.exam_id}`}>
                              Review
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
