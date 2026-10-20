'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { neonClient as neon } from '@/lib/neon';
import { useAuth } from '@/contexts/AuthContext';
import { Exam, ExamAttempt, Question, StudentAnswer } from '@/lib/types';
import {
  MCQ_OPTION_KEYS,
  MCQ_OPTION_LABELS,
  MCQ_OPTION_VALUES,
  getOptionImageUrl,
  type McqOptionLetter,
} from '@/lib/mcq-options';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  Loader2,
  Printer,
  FileText,
  Rows,
  Layers,
  ExternalLink,
} from 'lucide-react';

type AttemptRow = ExamAttempt & {
  profiles: { full_name: string } | null;
  exams: (Exam & { pdf_url?: string | null; option_count?: number }) | null;
};

export default function TeacherAttemptDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const attemptId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, StudentAnswer>>({});
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [showPdfModal, setShowPdfModal] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;

    const { data: row, error } = await neon
      .from('exam_attempts')
      .select('*, profiles(full_name), exams(*)')
      .eq('id', attemptId)
      .maybeSingle();

    if (error || !row) {
      router.replace('/teacher/results');
      return;
    }

    const att = row as AttemptRow;
    const exam = att.exams;
    if (!exam || exam.teacher_id !== user.id) {
      router.replace('/teacher/results');
      return;
    }

    setAttempt(att);

    const [qRes, ansRes] = await Promise.all([
      neon.from('questions').select('*').eq('exam_id', att.exam_id).order('order_index'),
      neon.from('student_answers').select('*').eq('attempt_id', att.id),
    ]);

    const qs = qRes.data || [];
    setQuestions(qs);

    const ansMap: Record<string, StudentAnswer> = {};
    (ansRes.data || []).forEach((a) => {
      ansMap[a.question_id] = a;
    });
    setSavedAnswers(ansMap);
    setLoading(false);
  }, [attemptId, user?.id, router]);

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
      if (profile) load();
    }
  }, [user, profile, authLoading, load, router]);

  const getGrade = (p: number) => {
    if (p >= 75) return { label: 'A', color: 'text-emerald-600' };
    if (p >= 65) return { label: 'B', color: 'text-emerald-600' };
    if (p >= 55) return { label: 'C', color: 'text-primary' };
    if (p >= 35) return { label: 'S', color: 'text-amber-600' };
    return { label: 'W', color: 'text-red-600' };
  };

  const printWithMode = (mode: 'compact' | 'detailed') => {
    setViewMode(mode);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!attempt) return null;

  const pct = attempt.total_points
    ? Math.round(((attempt.score || 0) / attempt.total_points) * 100)
    : 0;
  const grade = attempt.is_graded && attempt.total_points ? getGrade(pct) : null;
  const optionCount = attempt.exams?.option_count || 5;
  const letters: McqOptionLetter[] = MCQ_OPTION_VALUES.slice(0, optionCount);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 print:max-w-none print:px-2 print:py-0">
        {/* ── Top Header / Actions Bar (Hidden during print) ── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mb-1.5 h-8 gap-1.5 text-muted-foreground hover:text-slate-900"
              asChild
            >
              <Link href="/teacher/results">
                <ArrowLeft className="h-4 w-4" />
                Back to results
              </Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Attempt Details</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Student: <span className="font-semibold text-slate-800">{attempt.profiles?.full_name ?? 'Unknown student'}</span>
              {attempt.exams?.title ? ` &bull; ${attempt.exams.title}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Paper PDF Button if available */}
            {attempt.exams?.pdf_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPdfModal(true)}
                className="h-9 gap-1.5 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>View Question Paper PDF</span>
              </Button>
            )}

            {/* Print OMR Sheet Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => printWithMode('compact')}
              className="h-9 gap-1.5 border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span>Print OMR Sheet</span>
            </Button>

            {/* Print Detailed View Button */}
            <Button
              size="sm"
              onClick={() => printWithMode('detailed')}
              className="h-9 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
            >
              <Printer className="h-4 w-4" />
              <span>Print Detailed View</span>
            </Button>
          </div>
        </div>

        {/* ── Printable Header (Shown in Print & on Screen) ── */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 print:border-none print:shadow-none print:p-0 print:mb-3">
          {/* Print only brand title */}
          <div className="hidden print:block border-b-2 border-slate-800 pb-2 mb-3">
            <div className="flex justify-between items-baseline">
              <div>
                <h1 className="text-lg font-black uppercase tracking-wider text-slate-900">
                  ChemWithDula &bull; Examination Report
                </h1>
                <span className="text-xs font-semibold text-slate-600">
                  Mode: {viewMode === 'compact' ? 'OMR Answer Sheet (Compact)' : 'Detailed Question Review (OMR Structure)'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Printed: {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Exam Title</span>
                {attempt.exams?.pdf_url && (
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    PDF Paper
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{attempt.exams?.title ?? 'Exam'}</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Student: <strong className="text-slate-900">{attempt.profiles?.full_name ?? '—'}</strong>
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/80 print:bg-white print:border-slate-300 print:py-1.5">
              <div className="text-center pr-3 border-r border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900">
                  {attempt.is_graded ? `${attempt.score} / ${attempt.total_points}` : '—'}
                </p>
              </div>

              <div className="text-center pr-3 border-r border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</p>
                <p className={`text-xl sm:text-2xl font-black ${grade?.color || 'text-slate-800'}`}>
                  {grade?.label || '—'} <span className="text-xs font-normal text-slate-500">({pct}%)</span>
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</p>
                <p className="text-sm font-bold text-slate-800">
                  {attempt.submitted_at && attempt.started_at
                    ? `${Math.floor(
                        (new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 60000
                      )}m`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── View Mode Switcher (Hidden in Print) ── */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Questions & Answers</h2>
            <span className="text-xs bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {questions.length} Questions
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                viewMode === 'compact'
                  ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Rows className="h-3.5 w-3.5" />
              <span>Compact OMR Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                viewMode === 'detailed'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Detailed View (OMR Structure)</span>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 1: COMPACT OMR SHEET (1-PAGE FIT, MINIMUM SPACE)                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div
          className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-xs print:border-none print:p-0 ${
            viewMode === 'compact' ? 'block print:block' : 'hidden print:hidden'
          }`}
        >
          {/* Multi-column grid: 2 columns on desktop and print */}
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
            {questions.map((q, idx) => {
              const qNum = idx + 1;
              const ans = savedAnswers[q.id];
              const selected = ans?.selected_option as McqOptionLetter | undefined;
              const correctLetter = q.correct_option as McqOptionLetter;
              const isCorrect = selected ? selected === correctLetter : false;
              const isUnanswered = !selected;

              return (
                <div
                  key={q.id}
                  className={`flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg border text-xs transition-colors print:py-1 ${
                    isCorrect
                      ? 'border-emerald-200/80 bg-emerald-50/30'
                      : isUnanswered
                        ? 'border-slate-200 bg-slate-50/50 text-slate-500'
                        : 'border-red-200/80 bg-red-50/30'
                  }`}
                >
                  {/* Question Number Badge */}
                  <div className="flex items-center gap-1.5 w-10 shrink-0">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${
                        isCorrect
                          ? 'bg-emerald-600 text-white'
                          : isUnanswered
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-red-500 text-white'
                      }`}
                    >
                      {qNum < 10 ? `0${qNum}` : qNum}
                    </span>
                  </div>

                  {/* Answer numbers in the SAME ROW (Minimum space) */}
                  <div className="flex items-center justify-center gap-1.5 flex-1">
                    {letters.map((letter, optIdx) => {
                      const optNum = optIdx + 1;
                      const isStudentChoice = selected === letter;
                      const isCorrectChoice = correctLetter === letter;

                      let style = 'border-slate-200 bg-white text-slate-600';

                      if (isStudentChoice && isCorrectChoice) {
                        style =
                          'border-emerald-600 bg-emerald-600 text-white font-bold ring-1 ring-emerald-400';
                      } else if (isStudentChoice && !isCorrectChoice) {
                        style =
                          'border-red-500 bg-red-500 text-white font-bold line-through';
                      } else if (isCorrectChoice) {
                        style =
                          'border-emerald-500 bg-emerald-100 text-emerald-800 font-bold ring-2 ring-emerald-500';
                      } else {
                        style = 'border-slate-200/60 text-slate-400 opacity-60';
                      }

                      return (
                        <span
                          key={letter}
                          title={`Choice ${optNum}`}
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium ${style}`}
                        >
                          {optNum}
                        </span>
                      );
                    })}
                  </div>

                  {/* Result indicator in same row */}
                  <div className="flex items-center justify-end gap-1 w-14 shrink-0 text-right">
                    {isCorrect ? (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> +{q.points || 1}
                      </span>
                    ) : isUnanswered ? (
                      <span className="text-[10px] text-slate-400 italic">Omit</span>
                    ) : (
                      <span className="text-[11px] font-bold text-red-600 flex items-center gap-0.5">
                        <XCircle className="h-3.5 w-3.5" /> 0 pt
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 2: DETAILED VIEW (OMR-STRUCTURE, SAME-ROW CHOICES)            */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div
          className={`space-y-3 ${
            viewMode === 'detailed' ? 'block print:block' : 'hidden print:hidden'
          }`}
        >
          {/* Multi-column grid just like OMR structure to save maximum space */}
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3">
            {questions.map((q, idx) => {
              const qNum = idx + 1;
              const ans = savedAnswers[q.id];
              const selected = ans?.selected_option as McqOptionLetter | undefined;
              const isCorrect = ans?.is_correct ?? (selected ? selected === q.correct_option : false);
              const isUnanswered = !selected;
              const selectedNum = selected ? MCQ_OPTION_LABELS[selected] : null;
              const correctNum = MCQ_OPTION_LABELS[q.correct_option as McqOptionLetter] || q.correct_option;

              return (
                <div
                  key={q.id}
                  className={`break-inside-avoid print:break-inside-avoid rounded-xl border p-3 text-xs bg-white transition-colors ${
                    isCorrect
                      ? 'border-emerald-200/90 bg-emerald-50/20'
                      : isUnanswered
                        ? 'border-slate-200 bg-slate-50/40 text-slate-600'
                        : 'border-red-200/90 bg-red-50/20'
                  }`}
                >
                  {/* Card Header: Q# Badge, Points, Result indicator */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-600 text-white'
                            : isUnanswered
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-red-500 text-white'
                        }`}
                      >
                        {qNum < 10 ? `0${qNum}` : qNum}
                      </span>
                      <span className="font-bold text-slate-800 truncate">
                        Question {qNum}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        &bull; {q.points || 1} pt
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium text-slate-600">
                        Student:{' '}
                        <strong
                          className={
                            isCorrect
                              ? 'text-emerald-700'
                              : isUnanswered
                                ? 'text-slate-400'
                                : 'text-red-600'
                          }
                        >
                          {selectedNum ? `(${selectedNum})` : '—'}
                        </strong>
                      </span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Key: <strong className="text-emerald-700">({correctNum})</strong>
                      </span>
                      {isCorrect ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : isUnanswered ? (
                        <span className="text-[10px] text-slate-400 italic">Omit</span>
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                  </div>

                  {/* Question Image if present */}
                  {q.image_url && (
                    <div className="mb-2">
                      <img
                        src={q.image_url}
                        alt={`Q${qNum}`}
                        className="max-h-24 w-auto object-contain rounded border border-slate-200"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Question Text if present and meaningful */}
                  {q.question_text && q.question_text !== `Question ${qNum}` && (
                    <p className="text-xs font-medium text-slate-800 mb-2 leading-relaxed line-clamp-3">
                      {q.question_text}
                    </p>
                  )}

                  {/* OMR-like Choices in the SAME ROW / Compact Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {MCQ_OPTION_VALUES.slice(0, optionCount).map((opt, i) => {
                      const optKey = MCQ_OPTION_KEYS[i];
                      const optLabel = MCQ_OPTION_LABELS[opt];
                      const optImg = getOptionImageUrl(q, opt);
                      const isCorrectChoice = q.correct_option === opt;
                      const isStudentChoice = selected === opt;
                      const rawText = (q[optKey] || '').trim();

                      const isRedundant =
                        rawText === `(${optLabel})` ||
                        rawText === optLabel ||
                        rawText === `Option ${optLabel}` ||
                        rawText === '';

                      let chipStyle = 'border-slate-200 bg-slate-50/80 text-slate-600';

                      if (isStudentChoice && isCorrectChoice) {
                        chipStyle =
                          'border-emerald-600 bg-emerald-600 text-white font-bold ring-1 ring-emerald-300';
                      } else if (isStudentChoice && !isCorrectChoice) {
                        chipStyle =
                          'border-red-500 bg-red-500 text-white font-bold line-through';
                      } else if (isCorrectChoice) {
                        chipStyle =
                          'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-500';
                      }

                      return (
                        <div
                          key={opt}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] transition ${chipStyle}`}
                        >
                          <span className="font-bold">{optLabel}.</span>
                          {optImg && (
                            <img
                              src={optImg}
                              alt={`Opt ${optLabel}`}
                              className="h-4 w-auto object-contain rounded"
                            />
                          )}
                          {!isRedundant && (
                            <span className="truncate max-w-[120px] font-normal">{rawText}</span>
                          )}
                          {isCorrectChoice && (
                            <CheckCircle2
                              className={`h-3 w-3 ${
                                isStudentChoice ? 'text-white' : 'text-emerald-600'
                              } shrink-0`}
                            />
                          )}
                          {isStudentChoice && !isCorrectChoice && (
                            <XCircle className="h-3 w-3 text-white shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Question Paper PDF Modal ── */}
      {showPdfModal && attempt.exams?.pdf_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-sm truncate max-w-md">
                  {attempt.exams.title} &bull; Question Paper
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={attempt.exams.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in Tab</span>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPdfModal(false)}
                  className="h-7 px-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 overflow-hidden">
              <iframe
                src={`${attempt.exams.pdf_url}#toolbar=1`}
                className="h-full w-full border-none"
                title="Exam Paper"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Print Stylesheet for Minimum Space & 1-2 Page Fit ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }
          body {
            background: #ffffff !important;
            font-size: 11px !important;
            color: #000000 !important;
          }
          nav,
          header,
          footer,
          .print\\:hidden {
            display: none !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
