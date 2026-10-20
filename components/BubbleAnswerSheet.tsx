'use client';

import React from 'react';
import { McqOptionLetter, MCQ_OPTION_VALUES } from '@/lib/mcq-options';
import { Check, X, RotateCcw } from 'lucide-react';

interface BubbleAnswerSheetProps {
  questions: Array<{
    id: string;
    order_index: number;
    points?: number;
    correct_option?: string;
  }>;
  answers: Record<string, string>; // questionId -> letter ('a'..'e')
  optionCount?: number; // 4 or 5
  onSelectAnswer?: (questionId: string, letter: McqOptionLetter) => void;
  onClearAnswer?: (questionId: string) => void;
  disabled?: boolean;
  showResults?: boolean;
  activeQuestionIndex?: number;
  onQuestionClick?: (index: number) => void;
  className?: string;
}

const LETTER_TO_NUM: Record<string, number> = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
};

const NUM_TO_LETTER: Record<number, McqOptionLetter> = {
  1: 'a',
  2: 'b',
  3: 'c',
  4: 'd',
  5: 'e',
};

export default function BubbleAnswerSheet({
  questions,
  answers,
  optionCount = 5,
  onSelectAnswer,
  onClearAnswer,
  disabled = false,
  showResults = false,
  activeQuestionIndex,
  onQuestionClick,
  className = '',
}: BubbleAnswerSheetProps) {
  const letters: McqOptionLetter[] = MCQ_OPTION_VALUES.slice(0, optionCount);

  return (
    <div className={`flex flex-col divide-y divide-slate-100 ${className}`}>
      {questions.map((q, idx) => {
        const qNum = idx + 1;
        const selectedLetter = answers[q.id];
        const correctLetter = q.correct_option;
        const isAnswered = Boolean(selectedLetter);
        const isCorrect = showResults && selectedLetter === correctLetter;
        const isIncorrect = showResults && isAnswered && selectedLetter !== correctLetter;
        const isActive = activeQuestionIndex === idx;

        return (
          <div
            key={q.id || `q-${idx}`}
            onClick={() => onQuestionClick?.(idx)}
            className={`flex items-center justify-between gap-3 px-3 py-2.5 transition-colors ${
              isActive ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'hover:bg-slate-50/80'
            } ${showResults ? (isCorrect ? 'bg-emerald-50/40' : isIncorrect ? 'bg-red-50/30' : '') : ''}`}
          >
            {/* Question Label */}
            <div className="flex items-center gap-2 min-w-[54px] shrink-0">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                  showResults
                    ? isCorrect
                      ? 'bg-emerald-100 text-emerald-800'
                      : isIncorrect
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-500'
                    : isAnswered
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {qNum < 10 ? `0${qNum}` : qNum}
              </span>
            </div>

            {/* Answer Bubbles in the same row */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-1">
              {letters.map((letter, optIdx) => {
                const optNum = optIdx + 1;
                const isSelected = selectedLetter === letter;
                const isThisCorrect = showResults && correctLetter === letter;

                let bubbleStyle =
                  'border-slate-300 bg-white text-slate-700 hover:border-primary/50 hover:bg-slate-50';

                if (showResults) {
                  if (isSelected && isThisCorrect) {
                    bubbleStyle = 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-xs';
                  } else if (isSelected && !isThisCorrect) {
                    bubbleStyle = 'border-red-500 bg-red-500 text-white font-bold line-through shadow-xs';
                  } else if (isThisCorrect) {
                    bubbleStyle = 'border-emerald-500 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400 font-bold';
                  } else {
                    bubbleStyle = 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                  }
                } else if (isSelected) {
                  bubbleStyle =
                    'border-primary bg-primary text-primary-foreground font-bold shadow-xs ring-2 ring-primary/20 scale-105';
                }

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (disabled) return;
                      if (isSelected && onClearAnswer) {
                        onClearAnswer(q.id);
                      } else {
                        onSelectAnswer?.(q.id, letter);
                      }
                    }}
                    title={`Question ${qNum}, Option (${optNum})`}
                    className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border text-xs sm:text-sm font-semibold transition-all focus:outline-hidden disabled:cursor-not-allowed ${bubbleStyle}`}
                  >
                    <span>{optNum}</span>
                    {showResults && isSelected && isThisCorrect && (
                      <Check className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-700 p-0.5 text-white" />
                    )}
                    {showResults && isSelected && !isThisCorrect && (
                      <X className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-700 p-0.5 text-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Clear button if taking exam and answered */}
            {!showResults && !disabled && (
              <div className="w-6 shrink-0 flex justify-end">
                {isAnswered && onClearAnswer && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearAnswer(q.id);
                    }}
                    title="Clear choice"
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Score in results mode */}
            {showResults && (
              <div className="w-12 shrink-0 text-right">
                <span
                  className={`text-xs font-semibold ${
                    isCorrect ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {isCorrect ? `+${q.points || 1}` : '0'} pt
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { LETTER_TO_NUM, NUM_TO_LETTER };

