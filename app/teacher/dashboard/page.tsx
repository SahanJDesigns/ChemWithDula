'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam } from '@/lib/types';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Users, Clock, CircleCheck as CheckCircle2, Eye, EyeOff, ChartBar as BarChart3, Trash2, FileText } from 'lucide-react';

export default function TeacherDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/auth'); return; }
      if (profile && profile.role !== 'teacher') { router.push('/student/dashboard'); return; }
      if (profile) fetchExams();
    }
  }, [user, profile, authLoading, router]);

  const fetchExams = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('exams')
      .select('*, questions(count)')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });
    setExams(data || []);

    if (data && data.length > 0) {
      const ids = data.map((e) => e.id);
      const { data: attempts } = await supabase
        .from('exam_attempts')
        .select('exam_id')
        .in('exam_id', ids);
      const counts: Record<string, number> = {};
      (attempts || []).forEach((a) => {
        counts[a.exam_id] = (counts[a.exam_id] || 0) + 1;
      });
      setAttemptCounts(counts);
    }
    setLoading(false);
  };

  const togglePublish = async (exam: Exam) => {
    await supabase.from('exams').update({ is_published: !exam.is_published }).eq('id', exam.id);
    setExams((prev) => prev.map((e) => e.id === exam.id ? { ...e, is_published: !e.is_published } : e));
  };

  const deleteExam = async (id: string) => {
    if (!confirm('Delete this exam? This cannot be undone.')) return;
    await supabase.from('exams').delete().eq('id', id);
    setExams((prev) => prev.filter((e) => e.id !== id));
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const published = exams.filter((e) => e.is_published).length;
  const totalStudents = Object.values(attemptCounts).reduce((a, b) => a + b, 0);

  const navItems = [
    { label: 'All Exams', href: '/teacher/dashboard', icon: <BookOpen className="h-4 w-4" />, badge: exams.length },
    { label: 'Create Exam', href: '/teacher/exams/new', icon: <Plus className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout
      role="teacher"
      title="Exam Dashboard"
      subtitle={`Welcome back, ${profile?.full_name}`}
      navItems={navItems}
    >
      <div className="px-6 sm:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Exams', value: exams.length, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
            { label: 'Published', value: published, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Draft', value: exams.length - published, icon: FileText, color: 'text-amber-600 bg-amber-50' },
            { label: 'Student Attempts', value: totalStudents, icon: Users, color: 'text-sky-600 bg-sky-50' },
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

        {/* Exams list */}
        {exams.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-16 text-center">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No exams yet</h3>
            <p className="text-slate-500 mb-6">Create your first exam to get started.</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/teacher/exams/new"><Plus className="h-4 w-4 mr-2" />Create Exam</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Exam</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Questions</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Attempts</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((exam) => {
                  const qCount = (exam as unknown as { questions: { count: number }[] }).questions?.[0]?.count ?? 0;
                  const attempts = attemptCounts[exam.id] || 0;
                  return (
                    <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <p className="font-medium text-slate-900">{exam.title}</p>
                          {exam.description && <p className="text-xs text-slate-500 line-clamp-1">{exam.description}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-slate-600">{qCount}</td>
                      <td className="px-6 py-4 text-center text-sm text-slate-600">{exam.duration_minutes} min</td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-slate-900">{attempts}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          exam.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {exam.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="sm" asChild className="h-8 px-2.5 text-slate-500">
                            <Link href={`/teacher/exams/${exam.id}`}>Manage</Link>
                          </Button>
                          {attempts > 0 && (
                            <Button variant="ghost" size="sm" asChild className="h-8 px-2.5 text-blue-600 hover:text-blue-700">
                              <Link href={`/teacher/exams/${exam.id}/results`}>
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePublish(exam)}
                            className="h-8 px-2.5 text-slate-500 hover:text-slate-700"
                          >
                            {exam.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteExam(exam.id)}
                            className="h-8 px-2.5 text-red-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
