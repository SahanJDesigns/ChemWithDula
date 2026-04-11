'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, TriangleAlert as AlertTriangle } from 'lucide-react';

interface ExamTimerProps {
  startedAt: string;
  durationMinutes: number;
  onTimeUp: () => void;
}

export default function ExamTimer({ startedAt, durationMinutes, onTimeUp }: ExamTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [hasTriggered, setHasTriggered] = useState(false);

  const calculateSecondsLeft = useCallback(() => {
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    const now = Date.now();
    return Math.max(0, Math.floor((end - now) / 1000));
  }, [startedAt, durationMinutes]);

  useEffect(() => {
    setSecondsLeft(calculateSecondsLeft());

    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsLeft(remaining);
      if (remaining === 0 && !hasTriggered) {
        setHasTriggered(true);
        onTimeUp();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateSecondsLeft, onTimeUp, hasTriggered]);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const isWarning = secondsLeft <= 300 && secondsLeft > 0;
  const isCritical = secondsLeft <= 60 && secondsLeft > 0;
  const isExpired = secondsLeft === 0;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 border font-mono font-semibold text-lg transition-all ${
      isExpired
        ? 'bg-red-50 border-red-200 text-red-600'
        : isCritical
        ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
        : isWarning
        ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-blue-50 border-blue-200 text-blue-700'
    }`}>
      {isCritical || isExpired ? (
        <AlertTriangle className="h-5 w-5 shrink-0" />
      ) : (
        <Clock className="h-5 w-5 shrink-0" />
      )}
      <span>
        {hours > 0 && `${pad(hours)}:`}{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}
