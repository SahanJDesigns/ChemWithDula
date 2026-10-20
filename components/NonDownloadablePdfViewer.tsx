'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Loader2,
  FileText,
  AlertCircle,
  Eye,
  Rows,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NonDownloadablePdfViewerProps {
  pdfUrl: string;
  className?: string;
  title?: string;
}

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export default function NonDownloadablePdfViewer({
  pdfUrl,
  className = '',
  title = 'Exam Paper',
}: NonDownloadablePdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState<number>(0);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // 1. Dynamically load PDF.js from cdnjs if not already available
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.pdfjsLib) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setScriptLoaded(true);
      }
    };
    script.onerror = () => {
      setError('Failed to load PDF rendering engine. Please refresh the page.');
      setLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  // 2. Load PDF Document once script is ready
  useEffect(() => {
    if (!scriptLoaded || !pdfUrl || !window.pdfjsLib) return;

    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadingTask = window.pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: false,
    });

    loadingTask.promise
      .then((doc: any) => {
        if (isCancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.error('PDF.js load error:', err);
        setError('Could not load the exam paper. Please check your connection or file permissions.');
        setLoading(false);
      });

    return () => {
      isCancelled = true;
      if (loadingTask && loadingTask.destroy) {
        loadingTask.destroy();
      }
    };
  }, [scriptLoaded, pdfUrl]);

  // 3. Render page onto canvas
  const renderPage = useCallback(
    async (pageNumber: number, canvas: HTMLCanvasElement) => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale, rotation });
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // High-DPI support for ultra-sharp diagrams and text
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: ctx,
          transform: transform,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err: any) {
        // Ignore cancelled render tasks during quick zoom/scroll
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      }
    },
    [pdfDoc, scale, rotation]
  );

  // 4. Trigger render whenever doc, scale, rotation, viewMode, or page changes
  useEffect(() => {
    if (!pdfDoc || loading) return;

    if (viewMode === 'single') {
      const canvas = canvasRefs.current.get(currentPage);
      if (canvas) renderPage(currentPage, canvas);
    } else {
      // Continuous mode: render all pages
      for (let p = 1; p <= numPages; p++) {
        const canvas = canvasRefs.current.get(p);
        if (canvas) renderPage(p, canvas);
      }
    }
  }, [pdfDoc, loading, scale, rotation, viewMode, currentPage, numPages, renderPage]);

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Zoom helpers
  const zoomIn = () => setScale((s) => Math.min(3.0, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)));
  const resetZoom = () => setScale(1.2);
  const fitWidth = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    // Standard A4 width is ~595pt at scale 1.0
    const calculatedScale = Math.max(0.7, +(containerWidth / 620).toFixed(2));
    setScale(calculatedScale);
  };

  // Prevent right-click / context menu to block downloading
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className={`flex flex-col bg-slate-900 select-none overflow-hidden rounded-xl border border-slate-700 shadow-md ${className} ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 bg-slate-800/95 px-3 py-2 text-white shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-400 border border-slate-700">
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate max-w-[150px] sm:max-w-xs">{title}</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            (Protected Paper &bull; Read-Only)
          </span>
        </div>

        {/* View & Page Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {viewMode === 'single' ? (
            <div className="flex items-center gap-1 bg-slate-900/70 rounded-lg p-0.5 border border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-200 hover:bg-slate-700 disabled:opacity-30"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium text-slate-200 px-1">
                {currentPage} / {numPages || 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-200 hover:bg-slate-700 disabled:opacity-30"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-xs text-slate-300 font-medium px-2 py-1 rounded bg-slate-900/70 border border-slate-700">
              {numPages > 0 ? `${numPages} Pages` : 'Loading...'}
            </div>
          )}

          {/* View Mode Toggle: Continuous vs Single Page */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-slate-300 hover:bg-slate-700 hidden sm:flex items-center gap-1"
            onClick={() => setViewMode((m) => (m === 'continuous' ? 'single' : 'continuous'))}
            title={viewMode === 'continuous' ? 'Switch to single page view' : 'Switch to continuous scroll'}
          >
            {viewMode === 'continuous' ? <Rows className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
            <span>{viewMode === 'continuous' ? 'Scroll' : 'Single'}</span>
          </Button>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-slate-900/70 rounded-lg p-0.5 border border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-200 hover:bg-slate-700 disabled:opacity-30"
              onClick={zoomOut}
              disabled={scale <= 0.6}
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={fitWidth}
              className="text-xs font-semibold text-slate-300 px-1.5 hover:text-white"
              title="Click to Fit Width"
            >
              {Math.round(scale * 100)}%
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-200 hover:bg-slate-700 disabled:opacity-30"
              onClick={zoomIn}
              disabled={scale >= 3.0}
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Rotate button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-300 hover:bg-slate-700 hidden sm:inline-flex"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotate Page"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          {/* Fullscreen button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-300 hover:bg-slate-700"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Viewer Body (Canvas Presentation) ── */}
      <div
        className="relative flex-1 overflow-auto bg-slate-950 p-4 sm:p-6 flex flex-col items-center gap-6"
        style={{
          minHeight: '480px',
        }}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 gap-3 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm font-medium">Rendering exam paper...</p>
          </div>
        )}

        {error && (
          <div className="m-auto max-w-md rounded-xl border border-red-500/30 bg-red-950/40 p-6 text-center text-red-200 shadow-lg">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <p className="text-sm font-semibold">{error}</p>
            <p className="mt-2 text-xs text-red-300/70">
              If this continues, inform the teacher or reload your exam page.
            </p>
          </div>
        )}

        {!error && (
          <>
            {viewMode === 'single' ? (
              <div
                key={`single-${currentPage}`}
                className="relative rounded-lg shadow-2xl bg-white overflow-hidden border border-slate-700"
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(currentPage, el);
                    else canvasRefs.current.delete(currentPage);
                  }}
                  className="pointer-events-none block max-w-none"
                />
                <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                  Page {currentPage} of {numPages}
                </div>
              </div>
            ) : (
              // Continuous scroll: render every page vertically
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={`page-${pageNum}`}
                  className="relative rounded-lg shadow-2xl bg-white overflow-hidden border border-slate-700"
                >
                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current.set(pageNum, el);
                      else canvasRefs.current.delete(pageNum);
                    }}
                    className="pointer-events-none block max-w-none"
                  />
                  <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                    Page {pageNum} of {numPages}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* ── CSS to block printing and prevent download ── */}
      <style jsx global>{`
        @media print {
          canvas {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

