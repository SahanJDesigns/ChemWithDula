'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface ExamSecurityGuardProps {
  children: React.ReactNode;
  isActive: boolean;
  studentName?: string;
  studentEmail?: string;
  examTitle?: string;
}

export default function ExamSecurityGuard({
  children,
  isActive,
  studentName = 'Student',
  studentEmail = '',
  examTitle = 'Chemistry Exam',
}: ExamSecurityGuardProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [flashBlack, setFlashBlack] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show a gentle floating warning toast (never blocks the exam)
  const showWarning = useCallback((message: string) => {
    if (!isActive) return;
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);

    // Overwrite system clipboard to clear any captured image or text
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(
          '⚠️ Chem with Dula: Screenshots and copying exam materials are strictly prohibited.'
        ).catch(() => {});
      }
    } catch (e) {}
  }, [isActive]);

  // Flash black for 300ms on PrintScreen press so any OS screenshot grabs a black screen
  const triggerAntiCaptureFlash = useCallback(() => {
    setFlashBlack(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlashBlack(false);
    }, 350);
  }, []);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    // 1. Tab visibility change (Auto-hides when minimized/switched on mobile, auto-restores immediately when visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsTabHidden(true);
      } else {
        setIsTabHidden(false);
      }
    };

    // 2. Keyboard Intercepts (PrintScreen, Win+Shift+S, Mac screenshots, Ctrl+P, Copy)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isPrintScreen =
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44;

      const isWindowsSnip =
        (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS');

      const isMacScreenshot =
        e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key);

      const isPrint =
        (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP');

      const isSave =
        (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS');

      const isCopy =
        (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC');

      if (isPrintScreen || isWindowsSnip || isMacScreenshot) {
        e.preventDefault();
        e.stopPropagation();
        triggerAntiCaptureFlash();
        showWarning('Screenshots are disabled during the exam.');
        return false;
      }

      if (isPrint) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Printing is prohibited during exams.');
        return false;
      }

      if (isSave) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Saving page assets is prohibited.');
        return false;
      }

      if (isCopy) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Copying exam questions or answers is prohibited.');
        return false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        triggerAntiCaptureFlash();
        showWarning('Screenshots are disabled during the exam.');
      }
    };

    // 3. Prevent Right-Click Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 4. Prevent Copy & Cut events
    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData(
          'text/plain',
          '⚠️ Chem with Dula: Screenshots and copying exam materials are strictly prohibited.'
        );
      }
      showWarning('Copying content is disabled.');
    };

    // 5. Mobile: Block 3-finger swipe screenshot gesture
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length >= 3) {
        e.preventDefault();
        e.stopPropagation();
        triggerAntiCaptureFlash();
        showWarning('Multi-finger screen capture gesture detected.');
      }
    };

    // 6. Before Print event
    const handleBeforePrint = () => {
      showWarning('Printing is prohibited.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('copy', handleCopyCut, { capture: true });
    window.addEventListener('cut', handleCopyCut, { capture: true });
    window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
    window.addEventListener('beforeprint', handleBeforePrint, { capture: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('copy', handleCopyCut, { capture: true });
      window.removeEventListener('cut', handleCopyCut, { capture: true });
      window.removeEventListener('touchstart', handleTouchStart, { capture: true });
      window.removeEventListener('beforeprint', handleBeforePrint, { capture: true });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [isActive, showWarning, triggerAntiCaptureFlash]);

  // Construct dynamic forensic watermark SVG
  const watermarkText = `${studentName} • ${studentEmail || 'Protected'}`;
  const watermarkSub = `Chem with Dula • Confidential Exam`;
  const watermarkSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">
      <text x="20" y="70" fill="rgba(148, 163, 184, 0.14)" font-size="12" font-weight="bold" font-family="system-ui, -apple-system, sans-serif" transform="rotate(-22 20,70)">
        ${watermarkText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
      <text x="20" y="150" fill="rgba(148, 163, 184, 0.10)" font-size="10" font-family="system-ui, -apple-system, sans-serif" transform="rotate(-22 20,150)">
        ${watermarkSub.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
    </svg>
  `;
  const watermarkDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(watermarkSvg.trim())}`;

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative select-none exam-secure-mode"
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* ── Dynamic Repeating Forensic Watermark (PC & Mobile) ── */}
      <div
        className="pointer-events-none fixed inset-0 z-30 select-none"
        style={{
          backgroundImage: `url("${watermarkDataUri}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '340px 200px',
        }}
        aria-hidden="true"
      />

      {/* ── The Exam Content (Hidden only when tab is actively minimized / switched in mobile task switcher) ── */}
      <div className={isTabHidden ? 'invisible' : ''}>
        {children}
      </div>

      {/* ── Temporary Anti-Capture Flash Overlay (Active for 300ms only when PrintScreen is pressed) ── */}
      {flashBlack && (
        <div className="fixed inset-0 z-[99999] bg-black pointer-events-none" />
      )}

      {/* ── Non-Intrusive Floating Toast Warning (Disappears automatically after 2.5s) ── */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/95 border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-300 shadow-xl backdrop-blur-md">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ── Global Anti-Print / Anti-Copy Styles ── */}
      <style jsx global>{`
        @media print {
          html, body, .exam-secure-mode {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }
        }
        .exam-secure-mode img,
        .exam-secure-mode canvas {
          -webkit-user-drag: none !important;
          user-drag: none !important;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
