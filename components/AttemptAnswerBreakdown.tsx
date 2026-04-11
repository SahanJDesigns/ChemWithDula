'use client';

import Image from 'next/image';
import { CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';
import { Question, StudentAnswer } from '@/lib/types';
import { MCQ_OPTION_KEYS, MCQ_OPTION_LABELS, MCQ_OPTION_VALUES } from '@/lib/mcq-options';
import { cn } from '@/lib/utils';

export type AnswerWithQuestion = StudentAnswer & { questions: Question };

interface AttemptAnswerBreakdownProps {
  questions: Question[];
  answers: AnswerWithQuestion[];
  className?: string;
}

export function AttemptAnswerBreakdown({ questions, answers, className }: AttemptAnswerBreakdownProps) {
  return (
    <div className={cn('space-y-3 overflow-y-auto pr-1', className)}>
      {questions.map((q, idx) => {
        const answer = answers.find((a) => a.question_id === q.id);
        return (
          <div
            key={q.id}
            className={`rounded-xl border p-4 ${answer?.is_correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}
          >
            <div className="flex items-start gap-2.5 mb-3">
              {answer?.is_correct ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" size={18} />
              ) : (
                <XCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" size={18} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 mb-1">Q{idx + 1}</p>
                {q.image_url && (
                  <Image
                    src={q.image_url}
                    alt="Question"
                    width={160}
                    height={80}
                    className="rounded border border-slate-200 mb-1.5 max-h-20 w-auto object-contain"
                  />
                )}
                {q.question_text && <p className="text-sm font-medium text-slate-800 mb-2">{q.question_text}</p>}
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {MCQ_OPTION_VALUES.map((opt, i) => {
                    const optKey = MCQ_OPTION_KEYS[i];
                    const isCorrect = q.correct_option === opt;
                    const isSelected = answer?.selected_option === opt;
                    return (
                      <div
                        key={opt}
                        className={`rounded px-2 py-1 text-xs ${
                          isCorrect && isSelected
                            ? 'bg-emerald-100 text-emerald-700 font-medium'
                            : isCorrect
                              ? 'bg-emerald-50 text-emerald-600 font-medium'
                              : isSelected
                                ? 'bg-red-100 text-red-600'
                                : 'bg-white/60 text-slate-500'
                        }`}
                      >
                        <span className="font-bold">{MCQ_OPTION_LABELS[opt]}.</span> {q[optKey] as string}
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
  );
}
