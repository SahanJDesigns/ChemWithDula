'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt } from '@/lib/types';
import { getStudentExamStatus } from '@/lib/student-exam-status';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Clock, CircleCheck as CheckCircle2, CirclePlay as PlayCircle, Trophy, FileText, LayoutGrid } from 'lucide-react';

interface ExamWithAttempt extends Exam {
  attempt?: ExamAttempt;
  questionCount: number;
}

type Tab = 'active' | 'upcoming' | 'done';

export default function StudentDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('active');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/'); return; }
      if (profile && profile.role !== 'student') { router.push('/teacher/dashboard'); return; }
      if (profile) fetchExams();
    }
  }, [user, profile, authLoading, router]);

  const fetchExams = async () => {
    const [examsRes, attemptsRes] = await Promise.all([
      supabase.from('exams').select('*, questions(count)').eq('is_published', true).order('created_at', { ascending: false }),
      supabase.from('exam_attempts').select('*').eq('student_id', user!.id),
    ]);

    const attemptMap: Record<string, ExamAttempt> = {};
    (attemptsRes.data || []).forEach((a) => { attemptMap[a.exam_id] = a; });

    const enriched = (examsRes.data || []).map((exam) => ({
      ...exam,
      attempt: attemptMap[exam.id],
      questionCount: (exam as unknown as { questions: { count: number }[] }).questions?.[0]?.count ?? 0,
    }));

    setExams(enriched);
    setLoading(false);
  };

  const getExamTab = (exam: ExamWithAttempt): Tab => {
    const status = getStudentExamStatus(exam, exam.attempt);
    if (status === 'completed') return 'done';
    if (status === 'upcoming' || status === 'expired') return 'upcoming';
    return 'active'; // 'available' and 'in_progress'
  };

  const getFilteredExams = () => exams.filter((exam) => getExamTab(exam) === activeTab);

  const tabConfig: Record<Tab, { label: string; count: number }> = {
    active:   { label: 'Active',   count: exams.filter((e) => getExamTab(e) === 'active').length },
    upcoming: { label: 'Upcoming', count: exams.filter((e) => getExamTab(e) === 'upcoming').length },
    done:     { label: 'Done',     count: exams.filter((e) => getExamTab(e) === 'done').length },
  };

  const filteredExams = getFilteredExams();

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
      <div className="px-6 sm:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-border">
          {(Object.keys(tabConfig) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 border-b-2 font-medium text-sm transition-all ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tabConfig[tab].label}
              <span className="ml-2 text-xs font-bold">{tabConfig[tab].count}</span>
            </button>
          ))}
        </div>

        {/* Exams list */}
        {filteredExams.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-16 text-center">
            <LayoutGrid className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Nothing here</h3>
            <p className="text-sm text-muted-foreground">Try another tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExams.map((exam) => {
              const status = getStudentExamStatus(exam, exam.attempt);
              const canStart = status === 'available';
              const canContinue = status === 'in_progress';
              const isCompleted = status === 'completed';

              const statusColors = {
                completed: { badge: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200', button: 'bg-emerald-600 hover:bg-emerald-600/90' },
                in_progress: { badge: 'bg-primary/10 text-primary', button: 'bg-primary hover:bg-primary/90' },
                expired: { badge: 'bg-muted text-muted-foreground', button: '' },
                upcoming: { badge: 'bg-amber-500/10 text-amber-900 dark:text-amber-200', button: '' },
                available: { badge: 'bg-primary/10 text-primary', button: 'bg-primary hover:bg-primary/90' },
              };

              const color = statusColors[status];

              return (
                <div key={exam.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-muted-foreground/20 hover:shadow-md">
                  <div className="mb-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 font-semibold text-foreground">{exam.title}</h3>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${color.badge}`}>
                        {status === 'completed' && 'Completed'}
                        {status === 'in_progress' && 'In Progress'}
                        {status === 'available' && 'Available'}
                        {status === 'upcoming' && 'Upcoming'}
                        {status === 'expired' && 'Expired'}
                      </span>
                    </div>
                    {exam.description && <p className="line-clamp-2 text-xs text-muted-foreground">{exam.description}</p>}
                  </div>

                  <div className="mb-4 space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />{exam.questionCount} questions</div>
                    <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{exam.duration_minutes} min</div>
                  </div>

                  {isCompleted && exam.attempt && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Score</span>
                        <span className="text-sm font-bold text-emerald-600">
                          {exam.attempt.score}/{exam.attempt.total_points}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.round(((exam.attempt.score || 0) / (exam.attempt.total_points || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {(canStart || canContinue || isCompleted) && (
                      <Button asChild className={`flex-1 h-9 text-sm ${color.button}`}>
                        <Link href={`/student/exams/${exam.id}`}>
                          {canStart && <><PlayCircle className="h-3.5 w-3.5 mr-1.5" />Start</>}
                          {canContinue && <><Clock className="h-3.5 w-3.5 mr-1.5" />Continue</>}
                          {isCompleted && <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />View</>}
                        </Link>
                      </Button>
                    )}
                    {(status === 'upcoming' || status === 'expired') && (
                      <div className="flex h-9 flex-1 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                        {status === 'upcoming' ? 'Not yet open' : 'Closed'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}