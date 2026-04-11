'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Clock, BookOpen, CircleCheck as CheckCircle2, CirclePlay as PlayCircle, Trophy, Calendar, FileText } from 'lucide-react';

interface ExamWithAttempt extends Exam {
  attempt?: ExamAttempt;
  questionCount: number;
}

export default function StudentDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);

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

  const statusConfig = {
    completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
    expired: { label: 'Expired', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
    upcoming: { label: 'Upcoming', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    available: { label: 'Available', color: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500' },
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const completedExams = exams.filter((e) => e.attempt?.is_graded);
  const avgScore = completedExams.length > 0
    ? Math.round(completedExams.reduce((sum, e) => sum + ((e.attempt!.score || 0) / (e.attempt!.total_points || 1)) * 100, 0) / completedExams.length)
    : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Student Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back, {profile?.full_name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Available Exams', value: exams.filter((e) => getExamStatus(e) === 'available').length, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
            { label: 'Completed', value: completedExams.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Average Score', value: completedExams.length > 0 ? `${avgScore}%` : 'N/A', icon: Trophy, color: 'text-amber-600 bg-amber-50' },
            { label: 'In Progress', value: exams.filter((e) => getExamStatus(e) === 'in_progress').length, icon: PlayCircle, color: 'text-sky-600 bg-sky-50' },
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

        {/* Exams */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">All Exams</h2>
          {exams.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-16 text-center">
              <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No exams available</h3>
              <p className="text-slate-500">Your teachers haven&apos;t published any exams yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {exams.map((exam) => {
                const status = getExamStatus(exam);
                const cfg = statusConfig[status];
                const canStart = status === 'available';
                const canContinue = status === 'in_progress';
                const isCompleted = status === 'completed';

                return (
                  <div key={exam.id} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h3 className="font-semibold text-slate-900 truncate">{exam.title}</h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                          </div>
                        </div>
                        {exam.description && <p className="text-sm text-slate-500 mb-3 line-clamp-1">{exam.description}</p>}
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{exam.questionCount} questions</span>
                          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{exam.duration_minutes} min</span>
                          {exam.start_time && <span className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />Opens: {new Date(exam.start_time).toLocaleDateString()}</span>}
                          {exam.end_time && <span className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />Closes: {new Date(exam.end_time).toLocaleDateString()}</span>}
                        </div>
                        {isCompleted && exam.attempt && (
                          <div className="mt-3 flex items-center gap-3">
                            <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.round(((exam.attempt.score || 0) / (exam.attempt.total_points || 1)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-emerald-700 shrink-0">
                              {exam.attempt.score}/{exam.attempt.total_points} ({Math.round(((exam.attempt.score || 0) / (exam.attempt.total_points || 1)) * 100)}%)
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {(canStart || canContinue) && (
                          <Button asChild className={canStart ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'}>
                            <Link href={`/student/exams/${exam.id}`}>
                              {canStart ? <><PlayCircle className="h-4 w-4 mr-1.5" />Start Exam</> : <><Clock className="h-4 w-4 mr-1.5" />Continue</>}
                            </Link>
                          </Button>
                        )}
                        {isCompleted && (
                          <Button variant="outline" asChild>
                            <Link href={`/student/exams/${exam.id}`}>
                              <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" />View Results
                            </Link>
                          </Button>
                        )}
                        {status === 'upcoming' && (
                          <span className="text-sm text-slate-400">Not yet open</span>
                        )}
                        {status === 'expired' && !exam.attempt && (
                          <span className="text-sm text-slate-400">Closed</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
