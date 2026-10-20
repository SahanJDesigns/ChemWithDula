'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { neonClient as neon } from '@/lib/neon';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { localTimeToUTC } from '@/lib/utils';
import { parseExamZipFile, ParsedZipQuestion } from '@/lib/zip-parser';
import { MCQ_OPTION_LABELS, MCQ_OPTION_VALUES, McqOptionLetter } from '@/lib/mcq-options';
import {
  ArrowLeft,
  Upload,
  FileArchive,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
  ChevronRight,
  ClipboardPaste,
  Check,
  RotateCcw,
} from 'lucide-react';

const NUM_TO_LETTER: Record<number, McqOptionLetter> = {
  1: 'a',
  2: 'b',
  3: 'c',
  4: 'd',
  5: 'e',
};

const LETTER_TO_NUM: Record<string, number> = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
};

export default function NewExamPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  // Active Tab: 'pdf' | 'zip' | 'manual'
  const [tab, setTab] = useState<'pdf' | 'zip' | 'manual'>('pdf');

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: PDF EXAM STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfDescription, setPdfDescription] = useState('');
  const [pdfDuration, setPdfDuration] = useState(120);
  const [pdfStartTime, setPdfStartTime] = useState('');
  const [pdfEndTime, setPdfEndTime] = useState('');
  const [pdfQuestionCount, setPdfQuestionCount] = useState(50);
  const [pdfOptionCount, setPdfOptionCount] = useState<number>(5);
  const [pdfAnswerKey, setPdfAnswerKey] = useState<Record<number, McqOptionLetter>>({});
  const [pdfQuickKeyText, setPdfQuickKeyText] = useState('');
  const [showQuickPaste, setShowQuickPaste] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [isPdfDragOver, setIsPdfDragOver] = useState(false);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 2: BULK ZIP STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipTitle, setZipTitle] = useState('');
  const [zipDescription, setZipDescription] = useState('');
  const [zipDuration, setZipDuration] = useState(120);
  const [zipStartTime, setZipStartTime] = useState('');
  const [zipEndTime, setZipEndTime] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedZipQuestion[]>([]);
  const [answersOverride, setAnswersOverride] = useState<Record<number, McqOptionLetter>>({});
  const [unmatchedFiles, setUnmatchedFiles] = useState<string[]>([]);
  const [parsingZip, setParsingZip] = useState(false);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [zipError, setZipError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 3: MANUAL FORM STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
        return;
      }
      if (profile && profile.role !== 'teacher') {
        router.push('/student/dashboard');
      }
    }
  }, [user, profile, authLoading, router]);

  // ───────────────────────────────────────────────────────────────────────────
  // PDF Handlers
  // ───────────────────────────────────────────────────────────────────────────
  const handlePdfSelection = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setPdfError('Please upload a valid .pdf file.');
      return;
    }
    setPdfError('');
    setPdfFile(file);
    if (!pdfTitle) {
      const cleanName = file.name.replace(/\.pdf$/i, '').trim();
      setPdfTitle(cleanName);
    }
  };

  const parseQuickAnswerKey = () => {
    const text = pdfQuickKeyText.trim();
    if (!text) return;

    const result: Record<number, McqOptionLetter> = { ...pdfAnswerKey };
    const pairRegex = /(\d+)[\s:=-]+([1-5a-eA-E])/g;
    let match;
    let foundPairs = 0;

    while ((match = pairRegex.exec(text)) !== null) {
      const q = parseInt(match[1], 10);
      const ans = match[2].toLowerCase();
      const letter = (['1', '2', '3', '4', '5'].includes(ans)
        ? NUM_TO_LETTER[parseInt(ans, 10)]
        : ans) as McqOptionLetter;
      if (q >= 1 && q <= pdfQuestionCount) {
        result[q] = letter;
        foundPairs++;
      }
    }

    if (foundPairs === 0) {
      const tokens = text.split(/[\s,]+/);
      tokens.forEach((tok, idx) => {
        const q = idx + 1;
        if (q > pdfQuestionCount) return;
        const clean = tok.toLowerCase().replace(/[^1-5a-e]/g, '');
        if (!clean) return;
        const char = clean[0];
        const letter = (['1', '2', '3', '4', '5'].includes(char)
          ? NUM_TO_LETTER[parseInt(char, 10)]
          : char) as McqOptionLetter;
        result[q] = letter;
      });
    }

    setPdfAnswerKey(result);
    setPdfQuickKeyText('');
    setShowQuickPaste(false);
  };

  const handlePdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      setPdfError('Please select an exam PDF file to upload.');
      return;
    }
    if (!pdfTitle.trim()) {
      setPdfError('Exam title is required.');
      return;
    }
    if (pdfDuration < 1) {
      setPdfError('Duration must be at least 1 minute.');
      return;
    }
    if (pdfStartTime && pdfEndTime && new Date(pdfStartTime) >= new Date(pdfEndTime)) {
      setPdfError('Available Until must be after Available From.');
      return;
    }

    setPdfError('');
    setPdfUploading(true);

    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('title', pdfTitle.trim());
      formData.append('description', pdfDescription.trim());
      formData.append('duration_minutes', pdfDuration.toString());
      formData.append('start_time', pdfStartTime ? localTimeToUTC(pdfStartTime) : '');
      formData.append('end_time', pdfEndTime ? localTimeToUTC(pdfEndTime) : '');
      formData.append('is_published', 'true');
      formData.append('question_count', pdfQuestionCount.toString());
      formData.append('option_count', pdfOptionCount.toString());
      formData.append('answer_key', JSON.stringify(pdfAnswerKey));

      const res = await fetch('/api/exams/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to create PDF exam.');
      }

      router.push(`/teacher/exams/${json.exam_id}`);
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? err.message : 'Failed to upload PDF exam.');
    } finally {
      setPdfUploading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ZIP Handlers
  // ───────────────────────────────────────────────────────────────────────────
  const handleZipSelection = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setZipError('Please upload a valid .zip file containing question images.');
      return;
    }

    setZipError('');
    setParsingZip(true);
    setZipFile(file);

    try {
      const result = await parseExamZipFile(file, true);

      if (result.questions.length === 0) {
        setZipError(
          'No matching question images found in the ZIP archive. Images should be named like "1-3.png" (Question 1, Answer 3).'
        );
        setParsedQuestions([]);
        setUnmatchedFiles(result.unmatchedFiles);
        return;
      }

      setZipTitle(result.title);
      setParsedQuestions(result.questions);
      setUnmatchedFiles(result.unmatchedFiles);

      const initialAnswers: Record<number, McqOptionLetter> = {};
      result.questions.forEach((q) => {
        initialAnswers[q.qNum] = q.detectedAnswer;
      });
      setAnswersOverride(initialAnswers);
    } catch (err: unknown) {
      setZipError(err instanceof Error ? err.message : 'Failed to parse ZIP archive.');
    } finally {
      setParsingZip(false);
    }
  };

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile) {
      setZipError('Please select a ZIP file to upload.');
      return;
    }
    if (!zipTitle.trim()) {
      setZipError('Title is required.');
      return;
    }
    if (parsedQuestions.length === 0) {
      setZipError('No questions detected in the ZIP archive.');
      return;
    }
    if (zipDuration < 1) {
      setZipError('Duration must be at least 1 minute.');
      return;
    }
    if (zipStartTime && zipEndTime && new Date(zipStartTime) >= new Date(zipEndTime)) {
      setZipError('Available Until must be after Available From.');
      return;
    }

    setZipError('');
    setUploadingZip(true);

    try {
      const formData = new FormData();
      formData.append('file', zipFile);
      formData.append('mode', 'create');
      formData.append('title', zipTitle.trim());
      formData.append('description', zipDescription.trim());
      formData.append('duration_minutes', zipDuration.toString());
      formData.append('start_time', zipStartTime ? localTimeToUTC(zipStartTime) : '');
      formData.append('end_time', zipEndTime ? localTimeToUTC(zipEndTime) : '');
      formData.append('is_published', 'true');
      formData.append('answers_override', JSON.stringify(answersOverride));

      const res = await fetch('/api/exams/bulk-zip', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to upload and create exam.');
      }

      router.push(`/teacher/exams/${json.examId}`);
    } catch (err: unknown) {
      setZipError(err instanceof Error ? err.message : 'Failed to upload and create exam.');
    } finally {
      setUploadingZip(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Manual Handler
  // ───────────────────────────────────────────────────────────────────────────
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setManualError('You must be signed in as a teacher.');
      return;
    }
    if (!title.trim()) {
      setManualError('Title is required.');
      return;
    }
    if (duration < 1) {
      setManualError('Duration must be at least 1 minute.');
      return;
    }
    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      setManualError('Available Until must be after Available From.');
      return;
    }
    setManualError('');
    setManualLoading(true);
    try {
      const utcStartTime = startTime ? localTimeToUTC(startTime) : null;
      const utcEndTime = endTime ? localTimeToUTC(endTime) : null;

      const { data, error: insertError } = await neon
        .from('exams')
        .insert({
          title: title.trim(),
          description: description.trim(),
          teacher_id: user.id,
          duration_minutes: duration,
          start_time: utcStartTime,
          end_time: utcEndTime,
          is_published: false,
          option_count: 5,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!data?.id) throw new Error('Exam created, but failed to retrieve exam ID.');
      router.push(`/teacher/exams/${data.id}`);
    } catch (err: unknown) {
      setManualError(err instanceof Error ? err.message : 'Failed to create exam.');
    } finally {
      setManualLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const answeredKeyCount = Object.keys(pdfAnswerKey).length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Exams
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Exam</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload your complete exam PDF paper, import question images from ZIP, or create manually.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => setTab('pdf')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            tab === 'pdf'
              ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4 text-emerald-600" />
          <span>Full PDF Exam</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
            Fast
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('zip')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            tab === 'zip'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>ZIP Images Import</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            tab === 'manual'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Manual Builder</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: FULL PDF EXAM PAPER                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === 'pdf' && (
        <form onSubmit={handlePdfSubmit} className="space-y-6">
          {/* PDF Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsPdfDragOver(true);
            }}
            onDragLeave={() => setIsPdfDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsPdfDragOver(false);
              if (e.dataTransfer.files?.[0]) handlePdfSelection(e.dataTransfer.files[0]);
            }}
            onClick={() => pdfFileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isPdfDragOver
                ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                : pdfFile
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={pdfFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handlePdfSelection(e.target.files[0]);
              }}
            />

            <div className="max-w-md mx-auto flex flex-col items-center">
              <div
                className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                  pdfFile ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {pdfFile ? <CheckCircle2 className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
              </div>

              {pdfFile ? (
                <div>
                  <p className="text-base font-semibold text-slate-900">{pdfFile.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB &bull; PDF paper ready
                  </p>
                  <p className="text-xs text-emerald-600 font-medium mt-2">
                    Click or drag another file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold text-slate-800">
                    Click to upload or drag & drop exam PDF
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload the full exam question paper (e.g. 12 1st Term Test Paper - 01.pdf)
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                    <Upload className="h-3 w-3" />
                    <span>Select .PDF file</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {pdfError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <span>{pdfError}</span>
            </div>
          )}

          {/* Exam Details Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <h3 className="text-base font-semibold text-slate-900">Exam Details</h3>

            <div>
              <Label htmlFor="pdf-title" className="text-sm font-medium text-slate-700">
                Exam Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pdf-title"
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                placeholder="e.g. 12 1st Term Test Paper - 01 (Chemistry)"
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="pdf-desc" className="text-sm font-medium text-slate-700">
                Instructions / Description
              </Label>
              <Textarea
                id="pdf-desc"
                value={pdfDescription}
                onChange={(e) => setPdfDescription(e.target.value)}
                placeholder="e.g. All questions carry equal marks. Select the single best answer for each question."
                className="mt-1.5 resize-none h-20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="pdf-duration" className="text-sm font-medium text-slate-700">
                  Duration (Minutes)
                </Label>
                <Input
                  id="pdf-duration"
                  type="number"
                  min="1"
                  max="600"
                  value={pdfDuration}
                  onChange={(e) => setPdfDuration(Math.max(1, parseInt(e.target.value, 10) || 60))}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="pdf-qcount" className="text-sm font-medium text-slate-700">
                  Number of Questions
                </Label>
                <Input
                  id="pdf-qcount"
                  type="number"
                  min="1"
                  max="150"
                  value={pdfQuestionCount}
                  onChange={(e) =>
                    setPdfQuestionCount(
                      Math.max(1, Math.min(150, parseInt(e.target.value, 10) || 50))
                    )
                  }
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Choices Per Question</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPdfOptionCount(5)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      pdfOptionCount === 5
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    5 Choices (1–5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfOptionCount(4)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      pdfOptionCount === 4
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    4 Choices (1–4)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <Label htmlFor="pdf-start" className="text-sm font-medium text-slate-700">
                  Available From (Optional)
                </Label>
                <Input
                  id="pdf-start"
                  type="datetime-local"
                  value={pdfStartTime}
                  onChange={(e) => setPdfStartTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="pdf-end" className="text-sm font-medium text-slate-700">
                  Available Until (Optional)
                </Label>
                <Input
                  id="pdf-end"
                  type="datetime-local"
                  value={pdfEndTime}
                  onChange={(e) => setPdfEndTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          {/* Answer Key Grid Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Answer Key</h3>
                  <span className="text-xs bg-slate-100 font-semibold text-slate-600 px-2 py-0.5 rounded-full">
                    {answeredKeyCount} of {pdfQuestionCount} set
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click the dot corresponding to the correct answer for each question.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickPaste(!showQuickPaste)}
                  className="text-xs h-8 gap-1.5 border-slate-300"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>Paste Key</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPdfAnswerKey({})}
                  className="text-xs h-8 text-slate-500 hover:text-red-600"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>

            {/* Quick Paste Modal / Collapsible */}
            {showQuickPaste && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                <Label className="text-xs font-semibold text-emerald-900">
                  Paste Answer Key (e.g. &ldquo;1:3 2:1 3:4&rdquo; or &ldquo;3 1 4 2 5 2 3...&rdquo;)
                </Label>
                <Textarea
                  value={pdfQuickKeyText}
                  onChange={(e) => setPdfQuickKeyText(e.target.value)}
                  placeholder="Paste numbers (1-5) or letters (a-e)..."
                  className="bg-white text-xs font-mono h-20"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickPaste(false)}
                    className="text-xs h-7"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={parseQuickAnswerKey}
                    className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Apply Key
                  </Button>
                </div>
              </div>
            )}

            {/* Answer Bubbles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-h-[460px] overflow-y-auto pr-1">
              {Array.from({ length: pdfQuestionCount }, (_, i) => i + 1).map((qNum) => {
                const selectedLetter = pdfAnswerKey[qNum];
                const letters: McqOptionLetter[] = MCQ_OPTION_VALUES.slice(0, pdfOptionCount);

                return (
                  <div
                    key={qNum}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 border border-slate-100/60"
                  >
                    <span className="text-xs font-bold text-slate-600 w-8 shrink-0">
                      Q{qNum < 10 ? `0${qNum}` : qNum}
                    </span>

                    {/* Dots aligned in the same row */}
                    <div className="flex items-center gap-1.5">
                      {letters.map((letter, optIdx) => {
                        const optNum = optIdx + 1;
                        const isSelected = selectedLetter === letter;

                        return (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => {
                              setPdfAnswerKey((prev) => ({
                                ...prev,
                                [qNum]: isSelected ? ('a' as McqOptionLetter) : letter,
                              }));
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all border ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white font-bold ring-2 ring-emerald-200'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50'
                            }`}
                          >
                            {optNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/teacher/dashboard">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={pdfUploading || !pdfFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 font-semibold"
            >
              {pdfUploading ? 'Creating Exam Paper...' : 'Create PDF Exam'}
            </Button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: BULK ZIP IMPORT                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === 'zip' && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.[0]) handleZipSelection(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-primary bg-primary/5 scale-[0.99]'
                : parsedQuestions.length > 0
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleZipSelection(e.target.files[0]);
              }}
            />

            <div className="max-w-md mx-auto flex flex-col items-center">
              <div
                className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                  parsedQuestions.length > 0
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {parsedQuestions.length > 0 ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : (
                  <FileArchive className="h-7 w-7" />
                )}
              </div>

              {parsingZip ? (
                <div className="space-y-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                  <p className="text-sm font-medium text-slate-700">
                    Reading and extracting ZIP folder...
                  </p>
                </div>
              ) : parsedQuestions.length > 0 ? (
                <div>
                  <p className="text-base font-semibold text-slate-900">{zipFile?.name}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-1">
                    Successfully detected {parsedQuestions.length} questions
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Click or drag to replace ZIP file</p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold text-slate-800">
                    Drag and drop your exam ZIP file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Files should be named like <code className="text-primary font-mono">1-3.png</code>{' '}
                    (Q1, Answer 3)
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                    <Upload className="h-3 w-3" />
                    <span>Browse files</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {zipError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <span>{zipError}</span>
            </div>
          )}

          {parsedQuestions.length > 0 && (
            <form onSubmit={handleZipSubmit} className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <h3 className="text-base font-semibold text-slate-900">Exam Details</h3>
                <div>
                  <Label htmlFor="zip-title">Exam Title</Label>
                  <Input
                    id="zip-title"
                    value={zipTitle}
                    onChange={(e) => setZipTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="zip-desc">Description (Optional)</Label>
                  <Textarea
                    id="zip-desc"
                    value={zipDescription}
                    onChange={(e) => setZipDescription(e.target.value)}
                    className="resize-none h-20"
                  />
                </div>
                <div>
                  <Label htmlFor="zip-duration">Duration (Minutes)</Label>
                  <Input
                    id="zip-duration"
                    type="number"
                    min="1"
                    value={zipDuration}
                    onChange={(e) => setZipDuration(parseInt(e.target.value, 10) || 60)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/teacher/dashboard">
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={uploadingZip}>
                  {uploadingZip ? 'Creating Exam...' : 'Create Exam from ZIP'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: MANUAL FORM CREATION                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Exam Details</h3>
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unit 3 Quiz"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none h-20"
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (Minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
              />
            </div>
          </div>

          {manualError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {manualError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/teacher/dashboard">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={manualLoading}>
              {manualLoading ? 'Creating...' : 'Create & Add Questions'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
