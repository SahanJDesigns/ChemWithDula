'use client';

import React from 'react';
import { MCQ_OPTION_LABELS, McqOptionLetter } from '@/lib/mcq-options';

interface OptionDisplayProps {
  letter: McqOptionLetter;
  text?: string | null;
  imageUrl?: string | null;
  className?: string;
}

export default function OptionDisplay({
  letter,
  text = '',
  imageUrl,
  className = '',
}: OptionDisplayProps) {
  const label = MCQ_OPTION_LABELS[letter];
  const cleanText = (text || '').trim();
  const hasImage = Boolean(imageUrl && imageUrl.trim());

  // If text is literally just "(1)" or "1" or "Option 1" and an image is present,
  // we don't need redundant text cluttering the image
  const isRedundantText =
    hasImage &&
    (cleanText === `(${label})` ||
      cleanText === label ||
      cleanText.toLowerCase() === `option ${label}` ||
      cleanText.toLowerCase() === `option ${letter}`);

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2.5 min-w-0 ${className}`}>
      <span className="font-bold shrink-0 text-inherit">{label}.</span>
      <div className="flex flex-col gap-1.5 min-w-0">
        {hasImage && (
          <div className="relative rounded-lg border border-slate-200 bg-white p-1 overflow-hidden shadow-2xs max-w-xs sm:max-w-sm">
            <img
              src={imageUrl!}
              alt={`Option ${label}`}
              className="max-h-28 w-auto object-contain rounded"
              loading="lazy"
            />
          </div>
        )}
        {!isRedundantText && cleanText && (
          <span className="text-sm font-medium leading-relaxed break-words">{cleanText}</span>
        )}
      </div>
    </div>
  );
}

