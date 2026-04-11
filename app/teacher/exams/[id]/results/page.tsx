'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, Question, ExamAttempt, StudentAnswer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CircleCheck as CheckCircle2, Circle as XCircle, Clock, Trophy, Users, ChartBar as BarChart3 } from 'lucide-react';

interface AttemptWithAnswers extends Omit<ExamAttempt, 'profiles'> {
  profiles: { full_name: string };
  answers: (StudentAnswer & { questions: Question })[];
}

const OPTION_LABELS: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

export default function ExamResultsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<AttemptWithAnswers[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [examRes, questionsRes, attemptsRes] = await Promise.all([
      supabase.from('exams').select('*').eq('id', examId).maybeSingle(),
      supabase.from('questions').select('*').eq('exam_id', examId).order('order_index'),
      supabase.from('exam_attempts')
        .select('*, profiles(full_name)')
        .eq('exam_id', examId)
        .order('score', { ascending: false }),
    ]);

    if (!examRes.data || examRes.data.teacher_id !== user?.id) {
      router.push('/teacher/dashboard');
      return;
    }

    setExam(examRes.data);
    setQuestions(questionsRes.data || []);

    const attemptsData = (attemptsRes.data || []) as AttemptWithAnswers[];

    if (attemptsData.length > 0) {
      const ids = attemptsData.map((a) => a.id);
      const { data: answersData } = await supabase
        .from('student_answers')
        .select('*, questions(*)')
        .in('attempt_id', ids);

      const answersByAttempt = (answersData || []).reduce((acc, ans) => {
        if (!acc[ans.attempt_id]) acc[ans.attempt_id] = [];
        acc[ans.attempt_id].push(ans);
        return acc;
      }, {} as Record<string, typeof answersData>);

      setAttempts(attemptsData.map((a) => ({ ...a, answers: answersByAttempt[a.id] || [] })));
    } else {
      setAttempts([]);
    }
    setLoading(false);
  }, [examId, user, router]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/auth'); return; }
      if (profile && profile.role !== 'teacher') { router.push('/student/dashboard'); return; }
      if (profile) fetchData();
    }
  }, [user, profile, authLoading, fetchData, router]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!exam) return null;

  const gradedAttempts = attempts.filter((a) => a.is_graded);
  const avgScore = gradedAttempts.length > 0
    ? Math.round(gradedAttempts.reduce((sum, a) => sum + ((a.score || 0) / (a.total_points || 1)) * 100, 0) / gradedAttempts.length)
    : 0;
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const getGrade = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 90) return { label: 'A+', color: 'text-emerald-700 bg-emerald-50' };
    if (pct >= 80) return { label: 'A', color: 'text-emerald-600 bg-emerald-50' };
    if (pct >= 70) return { label: 'B', color: 'text-blue-700 bg-blue-50' };
    if (pct >= 60) return { label: 'C', color: 'text-amber-700 bg-amber-50' };
    if (pct >= 50) return { label: 'D', color: 'text-orange-700 bg-orange-50' };
    return { label: 'F', color: 'text-red-700 bg-red-50' };
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-500 -ml-2 mb-4">
            <Link href={`/teacher/exams/${examId}`}><ArrowLeft className="h-4 w-4" />Back to Exam</Link>
          </Button>
          <h1 className="text-xl font-bold text-slate-900">{exam.title} &mdash; Results</h1>
          <p className="text-sm text-slate-500 mt-1">{questions.length} questions &bull; {totalPoints} total points</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Attempts', value: attempts.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
            { label: 'Graded', value: gradedAttempts.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Average Score', value: `${avgScore}%`, icon: BarChart3, color: 'text-amber-600 bg-amber-50' },
            { label: 'Highest Score', value: gradedAttempts.length > 0 ? `${Math.round(((gradedAttempts[0].score || 0) / (gradedAttempts[0].total_points || 1)) * 100)}%` : 'N/A', icon: Trophy, color: 'text-sky-600 bg-sky-50' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.color} mb-3`}>
                <s.icon className="h-4.5 w-4.5" size={18} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className={`grid gap-6 ${selectedAttempt ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Attempts table */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-4">Student Results</h2>
            {attempts.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No students have attempted this exam yet.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attempts.map((attempt) => {
                      const pct = attempt.total_points ? Math.round(((attempt.score || 0) / attempt.total_points) * 100) : 0;
                      const grade = attempt.is_graded ? getGrade(attempt.score || 0, attempt.total_points || 1) : null;
                      return (
                        <tr key={attempt.id} className={`hover:bg-slate-50 transition-colors ${selectedAttempt?.id === attempt.id ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{attempt.profiles?.full_name}</td>
                          <td className="px-4 py-3 text-center">
                            {attempt.is_graded ? (
                              <span className="text-sm font-semibold text-slate-900">{attempt.score}/{attempt.total_points} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                            ) : (
                              <span className="text-xs text-slate-400 flex items-center justify-center gap-1"><Clock className="h-3 w-3" />In progress</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {grade ? (
                              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${grade.color}`}>{grade.label}</span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${attempt.is_graded ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {attempt.is_graded ? 'Graded' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {attempt.is_graded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedAttempt(selectedAttempt?.id === attempt.id ? null : attempt)}
                                className="text-xs h-7"
                              >
                                {selectedAttempt?.id === attempt.id ? 'Hide' : 'Details'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Answer breakdown */}
          {selectedAttempt && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">{selectedAttempt.profiles?.full_name}&apos;s Answers</h2>
                <button onClick={() => setSelectedAttempt(null)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const answer = selectedAttempt.answers.find((a) => a.question_id === q.id);
                  return (
                    <div key={q.id} className={`rounded-xl border p-4 ${answer?.is_correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                      <div className="flex items-start gap-2.5 mb-3">
                        {answer?.is_correct
                          ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" size={18} />
                          : <XCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" size={18} />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-500 mb-1">Q{idx + 1}</p>
                          {q.image_url && (
                            <Image src={q.image_url} alt="q" width={160} height={80} className="rounded border border-slate-200 mb-1.5 max-h-20 w-auto object-contain" />
                          )}
                          {q.question_text && <p className="text-sm font-medium text-slate-800 mb-2">{q.question_text}</p>}
                          <div className="grid grid-cols-2 gap-1">
                            {(['a', 'b', 'c', 'd'] as const).map((opt, i) => {
                              const optKey = ['option_a', 'option_b', 'option_c', 'option_d'][i] as keyof Question;
                              const isCorrect = q.correct_option === opt;
                              const isSelected = answer?.selected_option === opt;
                              return (
                                <div key={opt} className={`rounded px-2 py-1 text-xs ${
                                  isCorrect && isSelected ? 'bg-emerald-100 text-emerald-700 font-medium' :
                                  isCorrect ? 'bg-emerald-50 text-emerald-600 font-medium' :
                                  isSelected ? 'bg-red-100 text-red-600' :
                                  'bg-white/60 text-slate-500'
                                }`}>
                                  <span className="font-bold">{OPTION_LABELS[opt]}.</span> {q[optKey] as string}
                                </div>
                              );
                            })}
                          </div>
                          {!answer && <p className="text-xs text-slate-400 mt-1.5 italic">Not answered</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
