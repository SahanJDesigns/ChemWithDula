'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { localTimeToUTC } from '@/lib/utils';
import { ArrowLeft, BookOpen, Plus } from 'lucide-react';

export default function NewExamPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/'); return; }
      if (profile && profile.role !== 'teacher') { router.push('/student/dashboard'); }
    }
  }, [user, profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (duration < 1) { setError('Duration must be at least 1 minute.'); return; }
    setError('');
    setLoading(true);
    try {
      // Convert times from Asia/Colombo (datetime-local) to UTC
      const utcStartTime = startTime ? localTimeToUTC(startTime) : null;
      const utcEndTime = endTime ? localTimeToUTC(endTime) : null;

      const { data, error: insertError } = await supabase
        .from('exams')
        .insert({
          title: title.trim(),
          description: description.trim(),
          teacher_id: user!.id,
          duration_minutes: duration,
          start_time: utcStartTime,
          end_time: utcEndTime,
          is_published: false,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      router.push(`/teacher/exams/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create exam.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  return (
    <DashboardLayout
      role="teacher"
    >
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="title">Exam Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Biology Chapter 5 Quiz"
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Instructions or notes for students..."
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration (minutes) <span className="text-red-500">*</span></Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={480}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                className="mt-1.5"
                required
              />
              <p className="text-xs text-slate-400 mt-1">Students have this much time once they start the exam.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Available From <span className="text-slate-400 font-normal text-xs">(Asia/Colombo)</span></Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="endTime">Available Until <span className="text-slate-400 font-normal text-xs">(Asia/Colombo)</span></Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 -mt-3">If set, students can only start the exam within this window.</p>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3 pt-2 ">
              <Button
                type="submit"
                disabled={loading}
                className="w-40 ml-auto flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  'Create Exam'
                )}
              </Button>
          </div>
          </form>
        </div>
    </DashboardLayout>
  );
}
