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
  CircleX as XCircle,
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
    }, 250);
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
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 print:bg-white print:p-0 print:min-h-0 print:h-auto print:overflow-visible">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 print:max-w-none print:px-2 print:py-0 print:h-auto print:overflow-visible">
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
          <div className="hidden print:block border-b-2 border-slate-900 pb-2.5 mb-3">
            <div className="flex justify-between items-baseline">
              <div>
                <h1 className="text-2xl print:text-[32px] print-brand-title font-black uppercase tracking-wider text-slate-900 leading-tight">
                  Dulanjana Jayamaha
                </h1>
                <span className="text-xs font-semibold text-slate-700 print:text-[11px]">
                  Chemistry with Dulanjana Jayamaha &bull; A Level Chemistry
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
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
        {/* VIEW 1: COMPACT OMR SHEET (SINGLE COLUMN IN PRINT)                  */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div
          className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-xs print:border-none print:p-0 ${
            viewMode === 'compact' ? 'block print:block' : 'hidden print:hidden'
          }`}
        >
          {/* Single column when printing, 2 columns on desktop screen */}
          <div className="grid grid-cols-1 md:grid-cols-2 print:!grid-cols-1 print-single-column gap-x-6 gap-y-1 print:gap-y-1.5">
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
                  className={`break-inside-avoid print:break-inside-avoid flex items-center justify-between gap-3 py-2 px-3 rounded-lg border-2 text-xs transition-colors print:py-1.5 ${
                    isCorrect
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : isUnanswered
                        ? 'border-slate-300 bg-slate-50/70 text-slate-700'
                        : 'border-red-500 bg-red-50/70'
                  }`}
                >
                  {/* Question Number Badge */}
                  <div className="flex items-center gap-1.5 w-10 shrink-0">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold border ${
                        isCorrect
                          ? 'border-emerald-700 bg-emerald-600 text-white'
                          : isUnanswered
                            ? 'border-slate-400 bg-slate-200 text-slate-700'
                            : 'border-red-700 bg-red-600 text-white'
                      }`}
                    >
                      {qNum < 10 ? `0${qNum}` : qNum}
                    </span>
                  </div>

                  {/* Answer numbers in the SAME ROW (High contrast bubbles) */}
                  <div className="flex items-center justify-center gap-2 flex-1">
                    {letters.map((letter, optIdx) => {
                      const optNum = optIdx + 1;
                      const isStudentChoice = selected === letter;
                      const isCorrectChoice = correctLetter === letter;

                      let style = 'border border-slate-300 bg-white text-slate-700';

                      if (isStudentChoice && isCorrectChoice) {
                        style =
                          'border-2 border-emerald-700 bg-emerald-600 text-white font-bold shadow-xs';
                      } else if (isStudentChoice && !isCorrectChoice) {
                        style =
                          'border-2 border-red-700 bg-red-600 text-white font-bold';
                      } else if (isCorrectChoice) {
                        style =
                          'border-2 border-emerald-600 bg-emerald-100 text-emerald-950 font-bold';
                      } else {
                        style = 'border border-slate-300 bg-white text-slate-400 opacity-60';
                      }

                      return (
                        <span
                          key={letter}
                          title={`Choice ${optNum}`}
                          className={`relative flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${style}`}
                        >
                          {optNum}
                          {isStudentChoice && !isCorrectChoice && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-800 text-[9px] text-white font-black leading-none border border-white">
                              ✕
                            </span>
                          )}
                          {isStudentChoice && isCorrectChoice && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-800 text-[9px] text-white font-black leading-none border border-white">
                              ✓
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Result indicator in same row */}
                  <div className="flex items-center justify-end gap-1.5 shrink-0 text-right">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-600 text-emerald-950 text-xs font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700 stroke-[2.5]" />
                        <span>+{q.points || 1} pt</span>
                      </span>
                    ) : isUnanswered ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold">
                        <span>Omit (0 pt) &bull; Key: {MCQ_OPTION_LABELS[correctLetter] || correctLetter}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 border border-red-600 text-red-950 text-xs font-bold">
                        <XCircle className="h-4 w-4 text-red-700 stroke-[2.5]" />
                        <span>0 pt</span>
                        <span className="text-[11px] font-bold text-emerald-800">
                          (Key: {MCQ_OPTION_LABELS[correctLetter] || correctLetter})
                        </span>
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
          {/* Single column when printing, 2 columns on desktop screen */}
          <div className="grid grid-cols-1 md:grid-cols-2 print:!grid-cols-1 print-single-column gap-3">
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
                  className={`break-inside-avoid print:break-inside-avoid rounded-xl border-2 p-3.5 text-xs bg-white transition-colors ${
                    isCorrect
                      ? 'border-emerald-500 bg-emerald-50/20'
                      : isUnanswered
                        ? 'border-slate-300 bg-slate-50/30 text-slate-700'
                        : 'border-red-500 bg-red-50/20'
                  }`}
                >
                  {/* Card Header: Q# Badge, Points, Result indicator */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold shrink-0 border ${
                          isCorrect
                            ? 'border-emerald-700 bg-emerald-600 text-white'
                            : isUnanswered
                              ? 'border-slate-400 bg-slate-200 text-slate-700'
                              : 'border-red-700 bg-red-600 text-white'
                        }`}
                      >
                        {qNum < 10 ? `0${qNum}` : qNum}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        Question {qNum}
                      </span>
                    </div>
                  </div>

                  {/* Question Image if present */}
                  {q.image_url && (
                    <div className="mb-3 w-full">
                      <img
                        src={q.image_url}
                        alt={`Question ${qNum}`}
                        className="w-full h-auto object-contain rounded-lg border border-slate-200 block"
                        loading="eager"
                      />
                    </div>
                  )}

                  {/* Question Text if present and meaningful */}
                  {q.question_text && q.question_text !== `Question ${qNum}` && (
                    <p className="text-xs font-medium text-slate-800 mb-2 leading-relaxed">
                      {q.question_text}
                    </p>
                  )}

                  {/* OMR-like Choices in the SAME ROW / Compact Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
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

                      let chipStyle = 'border-slate-300 bg-white text-slate-700';

                      if (isStudentChoice && isCorrectChoice) {
                        chipStyle =
                          'border-2 border-emerald-600 bg-emerald-100 text-emerald-950 font-bold shadow-xs';
                      } else if (isStudentChoice && !isCorrectChoice) {
                        chipStyle =
                          'border-2 border-red-600 bg-red-100 text-red-950 font-bold';
                      } else if (isCorrectChoice) {
                        chipStyle =
                          'border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-bold';
                      }

                      return (
                        <div
                          key={opt}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition ${chipStyle}`}
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
                            <span className="truncate max-w-[140px] font-normal">{rawText}</span>
                          )}
                          {isStudentChoice && isCorrectChoice && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-black uppercase text-emerald-900 bg-emerald-200 px-1.5 py-0.5 rounded border border-emerald-400">
                              <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />
                              <span>Correct</span>
                            </span>
                          )}
                          {isStudentChoice && !isCorrectChoice && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-black uppercase text-red-900 bg-red-200 px-1.5 py-0.5 rounded border border-red-400">
                              <XCircle className="h-3 w-3 stroke-[2.5]" />
                              <span>Incorrect</span>
                            </span>
                          )}
                          {!isStudentChoice && isCorrectChoice && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-black uppercase text-emerald-900 bg-emerald-200 px-1.5 py-0.5 rounded border border-emerald-400">
                              <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />
                              <span>Correct</span>
                            </span>
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

      {/* ── Print Stylesheet for Single Column Multi-Page High-Contrast Print Output ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html,
          body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            font-size: 11px !important;
            color: #000000 !important;
          }
          /* Ensure all ancestors and layout wrappers allow multi-page flow and never clip */
          html body,
          #__next,
          main,
          div,
          section,
          article {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
          }
          /* Specifically prevent fixed viewport heights and scrolling containers from clipping */
          .h-screen,
          .overflow-hidden,
          .overflow-y-auto {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          nav,
          aside,
          header,
          footer,
          .print\\:hidden {
            display: none !important;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-single-column {
            grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
          }
          .print-brand-title {
            font-size: 32px !important;
            line-height: 1.15 !important;
            font-weight: 900 !important;
            letter-spacing: 0.04em !important;
          }
        }
      `}</style>
    </div>
  );
}
