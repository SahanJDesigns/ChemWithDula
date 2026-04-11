'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, Question } from '@/lib/types';
import { MCQ_OPTION_KEYS, MCQ_OPTION_LABELS, MCQ_OPTION_VALUES, type McqOptionLetter } from '@/lib/mcq-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Trash2, Image as ImageIcon, X, CircleCheck as CheckCircle2, Eye, EyeOff, ChartBar as BarChart3, GripVertical, Upload, BookOpen} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface QuestionFormData {
  question_text: string;
  image_url: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_option: McqOptionLetter;
  points: number;
}

const emptyQuestion = (): QuestionFormData => ({
  question_text: '',
  image_url: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  option_e: '',
  correct_option: 'a',
  points: 1,
});

export default function ManageExamPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<QuestionFormData>(emptyQuestion());
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [examRes, questionsRes] = await Promise.all([
      supabase.from('exams').select('*').eq('id', examId).maybeSingle(),
      supabase.from('questions').select('*').eq('exam_id', examId).order('order_index'),
    ]);
    if (!examRes.data || examRes.data.teacher_id !== user?.id) {
      router.push('/teacher/dashboard');
      return;
    }
    setExam(examRes.data);
    setQuestions(questionsRes.data || []);
    setLoading(false);
  }, [examId, user, router]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push('/'); return; }
      if (profile && profile.role !== 'teacher') { router.push('/student/dashboard'); return; }
      if (profile) fetchData();
    }
  }, [user, profile, authLoading, fetchData, router]);

  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('exam-images').upload(filename, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('exam-images').getPublicUrl(filename);
      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
    } catch (err) {
      setFormError('Image upload failed. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };

  const validateForm = () => {
    if (!formData.question_text.trim() && !formData.image_url) {
      setFormError('Question text or image is required.');
      return false;
    }
    if (
      !formData.option_a.trim() ||
      !formData.option_b.trim() ||
      !formData.option_c.trim() ||
      !formData.option_d.trim() ||
      !formData.option_e.trim()
    ) {
      setFormError('All five options are required.');
      return false;
    }
    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validateForm()) return;
    setFormError('');
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('questions').update({
          question_text: formData.question_text.trim(),
          image_url: formData.image_url || null,
          option_a: formData.option_a.trim(),
          option_b: formData.option_b.trim(),
          option_c: formData.option_c.trim(),
          option_d: formData.option_d.trim(),
          option_e: formData.option_e.trim(),
          correct_option: formData.correct_option,
          points: formData.points,
        }).eq('id', editingId);
      } else {
        await supabase.from('questions').insert({
          exam_id: examId,
          question_text: formData.question_text.trim(),
          image_url: formData.image_url || null,
          option_a: formData.option_a.trim(),
          option_b: formData.option_b.trim(),
          option_c: formData.option_c.trim(),
          option_d: formData.option_d.trim(),
          option_e: formData.option_e.trim(),
          correct_option: formData.correct_option,
          order_index: questions.length,
          points: formData.points,
        });
      }
      setFormData(emptyQuestion());
      setShowAddForm(false);
      setEditingId(null);
      await fetchData();
    } catch (err) {
      setFormError('Failed to save question. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (q: Question) => {
    setFormData({
      question_text: q.question_text,
      image_url: q.image_url || '',
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e ?? '',
      correct_option: q.correct_option,
      points: q.points,
    });
    setEditingId(q.id);
    setShowAddForm(true);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await supabase.from('questions').delete().eq('id', id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const togglePublish = async () => {
    if (!exam) return;
    await supabase.from('exams').update({ is_published: !exam.is_published }).eq('id', exam.id);
    setExam((prev) => prev ? { ...prev, is_published: !prev.is_published } : prev);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData(emptyQuestion());
    setFormError('');
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!exam) return null;

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <DashboardLayout
      role="teacher"
    >

    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{exam.title}</h1>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  exam.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {exam.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                <span>{exam.duration_minutes} min</span>
                <span>&bull;</span>
                <span>{questions.length} questions</span>
                <span>&bull;</span>
                <span>{totalPoints} total points</span>
                {exam.start_time && <><span>&bull;</span><span>Opens: {new Date(exam.start_time).toLocaleString()}</span></>}
                {exam.end_time && <><span>&bull;</span><span>Closes: {new Date(exam.end_time).toLocaleString()}</span></>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={togglePublish}
                className={exam.is_published ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}
              >
                {exam.is_published ? <><EyeOff className="h-4 w-4 mr-1.5" />Unpublish</> : <><Eye className="h-4 w-4 mr-1.5" />Publish</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Add/Edit Question Form */}
        {showAddForm ? (
          <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Question' : 'Add New Question'}
              </h2>
              <button onClick={cancelForm} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Question Text <span className="text-slate-400 font-normal text-xs">(leave blank if using image only)</span></Label>
                <Textarea
                  value={formData.question_text}
                  onChange={(e) => setFormData((p) => ({ ...p, question_text: e.target.value }))}
                  placeholder="Enter your question here..."
                  className="mt-1.5 resize-none"
                  rows={3}
                />
              </div>

              {/* Image upload */}
              <div>
                <Label>Question Image <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                {formData.image_url ? (
                  <div className="mt-1.5 relative inline-block">
                    <Image
                      src={formData.image_url}
                      alt="Question"
                      width={320}
                      height={200}
                      className="rounded-lg border border-slate-200 max-h-48 w-auto object-contain"
                    />
                    <button
                      onClick={() => setFormData((p) => ({ ...p, image_url: '' }))}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1.5 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {imageUploading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-400" />
                        <span className="text-sm text-slate-500">Click to upload image</span>
                        <span className="text-xs text-slate-400">PNG, JPG, GIF up to 5MB</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                    />
                  </label>
                )}
              </div>

              {/* Options */}
              <div>
                <Label className="mb-2 block">Answer Options <span className="text-red-500">*</span></Label>
                <div className="space-y-2.5">
                  {MCQ_OPTION_KEYS.map((key, i) => {
                    const letter = MCQ_OPTION_VALUES[i];
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, correct_option: letter }))}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                            formData.correct_option === letter
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-slate-300 text-slate-400 hover:border-slate-400'
                          }`}
                          title="Mark as correct answer"
                        >
                          {formData.correct_option === letter ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            MCQ_OPTION_LABELS[letter]
                          )}
                        </button>
                        <Input
                          value={formData[key]}
                          onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={`Option ${MCQ_OPTION_LABELS[letter]}`}
                          className="flex-1"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-2">Click the circle to mark the correct answer (shown in green).</p>
              </div>

              <div className="w-24">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min={1}
                  value={formData.points}
                  onChange={(e) => setFormData((p) => ({ ...p, points: parseInt(e.target.value) || 1 }))}
                  className="mt-1.5"
                />
              </div>

              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveQuestion} disabled={saving || imageUploading}>
                  {saving ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : editingId ? 'Update Question' : 'Add Question'}
                </Button>
                <Button variant="outline" onClick={cancelForm}>Cancel</Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => { setShowAddForm(true); setFormData(emptyQuestion()); setEditingId(null); }}
            className="mb-6 gap-2"
          >
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        )}

        {/* Questions list */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Questions ({questions.length})
          </h2>
          {questions.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
              <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No questions yet. Add your first question above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <GripVertical className="h-4 w-4 text-slate-300" />
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {q.image_url && (
                        <Image
                          src={q.image_url}
                          alt="Question image"
                          width={200}
                          height={120}
                          className="rounded-lg border border-slate-200 mb-2 max-h-32 w-auto object-contain"
                        />
                      )}
                      {q.question_text && (
                        <p className="text-sm font-medium text-slate-800 mb-2">{q.question_text}</p>
                      )}
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {MCQ_OPTION_KEYS.map((key, i) => {
                          const letter = MCQ_OPTION_VALUES[i];
                          const isCorrect = q.correct_option === letter;
                          return (
                            <div
                              key={key}
                              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
                                isCorrect ? 'bg-emerald-50 font-medium text-emerald-700' : 'bg-slate-50 text-slate-600'
                              }`}
                            >
                              <span className={`font-bold ${isCorrect ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {MCQ_OPTION_LABELS[letter]}.
                              </span>
                              {q[key]}
                              {isCorrect && <CheckCircle2 className="ml-auto h-3 w-3 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{q.points} point{q.points !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(q)} className="h-8 px-2.5 text-slate-500">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteQuestion(q.id)} className="h-8 px-2 text-red-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {questions.length > 0 && !exam.is_published && (
          <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">Ready to publish?</p>
              <p className="text-xs text-emerald-600 mt-0.5">Publishing makes this exam visible to students.</p>
            </div>
            <Button onClick={togglePublish} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
              <Eye className="h-4 w-4 mr-1.5" /> Publish Now
            </Button>
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
