'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt } from '@/lib/types';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Clock, BookOpen, CircleCheck as CheckCircle2, CirclePlay as PlayCircle, Trophy, Calendar, FileText, LayoutGrid } from 'lucide-react';

interface ExamWithAttempt extends Exam {
  attempt?: ExamAttempt;
  questionCount: number;
}

type Tab = 'available' | 'in-progress' | 'completed' | 'upcoming';

export default function StudentDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('available');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/auth'); return; }
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

  const getExamStatus = (exam: ExamWithAttempt) => {
    const now = new Date();
    if (exam.attempt?.is_graded) return 'completed';
    if (exam.attempt && !exam.attempt.submitted_at) return 'in_progress';
    if (exam.end_time && new Date(exam.end_time) < now) return 'expired';
    if (exam.start_time && new Date(exam.start_time) > now) return 'upcoming';
    return 'available';
  };

  const getFilteredExams = () => {
    return exams.filter((exam) => {
      const status = getExamStatus(exam);
      if (activeTab === 'available') return status === 'available';
      if (activeTab === 'in-progress') return status === 'in_progress';
      if (activeTab === 'completed') return status === 'completed';
      if (activeTab === 'upcoming') return status === 'upcoming' || status === 'expired';
      return false;
    });
  };

  const tabConfig = {
    available: { label: 'Available Now', count: exams.filter((e) => getExamStatus(e) === 'available').length },
    'in-progress': { label: 'In Progress', count: exams.filter((e) => getExamStatus(e) === 'in_progress').length },
    completed: { label: 'Completed', count: exams.filter((e) => getExamStatus(e) === 'completed').length },
    upcoming: { label: 'Upcoming/Expired', count: exams.filter((e) => ['upcoming', 'expired'].includes(getExamStatus(e))).length },
  };

  const filteredExams = getFilteredExams();
  const completedExams = exams.filter((e) => e.attempt?.is_graded);
  const avgScore = completedExams.length > 0
    ? Math.round(completedExams.reduce((sum, e) => sum + ((e.attempt!.score || 0) / (e.attempt!.total_points || 1)) * 100, 0) / completedExams.length)
    : 0;

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const navItems = [
    { label: 'Available', href: '/student/dashboard', icon: <PlayCircle className="h-4 w-4" />, badge: tabConfig.available.count },
    { label: 'In Progress', href: '#', icon: <Clock className="h-4 w-4" />, badge: tabConfig['in-progress'].count },
    { label: 'Completed', href: '#', icon: <CheckCircle2 className="h-4 w-4" />, badge: tabConfig.completed.count },
    { label: 'Upcoming', href: '#', icon: <Calendar className="h-4 w-4" />, badge: tabConfig.upcoming.count },
  ];

  return (
    <DashboardLayout
      role="student"
      title="Exam Portal"
      subtitle={`Welcome back, ${profile?.full_name}`}
      navItems={navItems}
    >
      <div className="px-6 sm:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Available', value: tabConfig.available.count, icon: PlayCircle, color: 'text-teal-600 bg-teal-50' },
            { label: 'Completed', value: completedExams.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Average Score', value: completedExams.length > 0 ? `${avgScore}%` : 'N/A', icon: Trophy, color: 'text-amber-600 bg-amber-50' },
            { label: 'In Progress', value: tabConfig['in-progress'].count, icon: Clock, color: 'text-sky-600 bg-sky-50' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${stat.color} mb-3`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200 flex gap-1">
          {(Object.keys(tabConfig) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 border-b-2 font-medium text-sm transition-all ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tabConfig[tab].label}
              <span className="ml-2 text-xs font-bold">{tabConfig[tab].count}</span>
            </button>
          ))}
        </div>

        {/* Exams list */}
        {filteredExams.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-16 text-center">
            <LayoutGrid className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No exams in this category</h3>
            <p className="text-slate-500">Check back later for more exams.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExams.map((exam) => {
              const status = getExamStatus(exam);
              const canStart = status === 'available';
              const canContinue = status === 'in_progress';
              const isCompleted = status === 'completed';

              const statusColors = {
                completed: { badge: 'bg-emerald-50 text-emerald-700', button: 'bg-emerald-600 hover:bg-emerald-700' },
                in_progress: { badge: 'bg-blue-50 text-blue-700', button: 'bg-blue-600 hover:bg-blue-700' },
                expired: { badge: 'bg-slate-100 text-slate-500', button: '' },
                upcoming: { badge: 'bg-amber-50 text-amber-700', button: '' },
                available: { badge: 'bg-teal-50 text-teal-700', button: 'bg-teal-600 hover:bg-teal-700' },
              };

              const color = statusColors[status];

              return (
                <div key={exam.id} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-all hover:shadow-sm">
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-slate-900 line-clamp-1">{exam.title}</h3>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${color.badge}`}>
                        {status === 'completed' && 'Completed'}
                        {status === 'in_progress' && 'In Progress'}
                        {status === 'available' && 'Available'}
                        {status === 'upcoming' && 'Upcoming'}
                        {status === 'expired' && 'Expired'}
                      </span>
                    </div>
                    {exam.description && <p className="text-xs text-slate-500 line-clamp-2">{exam.description}</p>}
                  </div>

                  <div className="space-y-2 mb-4 text-xs text-slate-600">
                    <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />{exam.questionCount} questions</div>
                    <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{exam.duration_minutes} min</div>
                  </div>

                  {isCompleted && exam.attempt && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-600">Score</span>
                        <span className="text-sm font-bold text-emerald-600">
                          {exam.attempt.score}/{exam.attempt.total_points}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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
                      <div className="flex-1 h-9 flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 font-medium">
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
