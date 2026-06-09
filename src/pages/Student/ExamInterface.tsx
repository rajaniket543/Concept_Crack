import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import ExamOption from './components/ExamOption';
import QuestionPalette, { type PaletteState } from './components/QuestionPalette';
import {
  currentStudent,
  examMeta,
  genExamQuestions,
  type ExamOption as ExamOptionType,
} from '../../mocks/student';
import { pathFor } from '../../lib/pages';

const questions = genExamQuestions(examMeta.totalQuestions);

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function ExamInterface() {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(examMeta.durationSeconds);
  const [current, setCurrent] = useState(examMeta.currentIndex);
  const [answers, setAnswers] = useState<Record<number, ExamOptionType['key']>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paletteState, setPaletteState] = useState<Record<number, PaletteState>>(() =>
    Object.fromEntries(
      Array.from({ length: examMeta.totalQuestions }, (_, i) => [i + 1, 'not-visited' as PaletteState]),
    ),
  );
  const [monitoringOpacity, setMonitoringOpacity] = useState(0.5);

  // Mark current question as visited on mount / on change.
  useEffect(() => {
    setPaletteState((prev) => {
      if (prev[current] === 'not-visited') return { ...prev, [current]: 'not-visited' };
      return prev;
    });
  }, [current]);

  // Countdown timer.
  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  // Monitoring pill: bright on mousemove, fade after 3s of idle.
  useEffect(() => {
    let timeout: number | undefined;
    const onMove = () => {
      setMonitoringOpacity(1);
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setMonitoringOpacity(0.5), 3000);
    };
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);

  // Right-click + Ctrl/Cmd+C/V/I block.
  useEffect(() => {
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'i'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        alert('Action Restricted: PrepMind AI maintains strict exam integrity.');
      }
    };
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ sessionId: string }>(`/api/exams/${examMeta.id}/start`, { method: 'POST' })
      .then((data) => {
        if (!cancelled) setSessionId(data.sessionId);
      })
      .catch(() => {
        if (!cancelled) setSessionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const question = questions[current - 1];
  const selectedKey = answers[current] ?? null;

  function onSelect(key: ExamOptionType['key']) {
    setAnswers((prev) => ({ ...prev, [current]: key }));
    setPaletteState((prev) => ({ ...prev, [current]: 'answered' }));
    if (sessionId) {
      void apiRequest(`/api/exams/sessions/${sessionId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({ questionId: current, answer: key }),
      }).catch(() => undefined);
    }
  }

  function clearResponse() {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[current];
      return next;
    });
    setPaletteState((prev) => ({ ...prev, [current]: 'not-visited' }));
    if (sessionId) {
      void apiRequest(`/api/exams/sessions/${sessionId}/clear`, {
        method: 'PATCH',
        body: JSON.stringify({ questionId: current }),
      }).catch(() => undefined);
    }
  }

  function toggleMarkForReview() {
    setMarked((prev) => {
      const next = new Set(prev);
      const wasMarked = next.has(current);
      if (wasMarked) {
        next.delete(current);
        setPaletteState((p) => ({ ...p, [current]: answers[current] ? 'answered' : 'not-visited' }));
      } else {
        next.add(current);
        setPaletteState((p) => ({ ...p, [current]: 'marked' }));
      }
      if (sessionId) {
        void apiRequest(`/api/exams/sessions/${sessionId}/mark`, {
          method: 'PATCH',
          body: JSON.stringify({ questionId: current, marked: !wasMarked }),
        }).catch(() => undefined);
      }
      return next;
    });
  }

  function saveAndNext() {
    setCurrent((c) => Math.min(examMeta.totalQuestions, c + 1));
  }

  function previous() {
    setCurrent((c) => Math.max(1, c - 1));
  }

  function selectFromPalette(id: number) {
    setCurrent(id);
  }

  async function submitExam() {
    if (sessionId) {
      try {
        await apiRequest(`/api/exams/sessions/${sessionId}/submit`, {
          method: 'POST',
          body: JSON.stringify({ answers }),
        });
      } catch {
        // Keep the UI moving even if the backend submission fails in dev.
      }
    }
    navigate(pathFor('analysis'));
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface overflow-hidden">
      {/* Top header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-container-desktop h-16 bg-surface border-b border-outline-variant shadow-sm">
        <div className="flex items-center gap-stack-md">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">PrepMind AI</h1>
          <div className="h-8 w-[1px] bg-outline-variant mx-4" />
          <div className="flex flex-col">
            <span className="font-label-lg text-label-lg text-on-surface">{examMeta.title}</span>
            <span className="text-[10px] uppercase tracking-wider text-outline font-bold">
              Session ID: {examMeta.id}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-gutter">
          <div className="flex items-center gap-2 bg-error-container text-on-error-container px-4 py-2 rounded-lg font-bold">
            <span className="material-symbols-outlined text-[20px]">timer</span>
            <span className="font-mono text-title-lg tracking-widest">{formatTime(seconds)}</span>
          </div>
          <button
            type="button"
            onClick={submitExam}
            className="bg-primary text-on-primary px-6 py-2 rounded-lg font-label-lg hover:opacity-90 transition-all cursor-pointer active:opacity-80"
          >
            Submit Exam
          </button>
        </div>
      </header>

      <main className="pt-16 h-screen flex overflow-hidden">
        {/* Question area (center) */}
        <section className="flex-1 overflow-y-auto bg-surface-container-lowest flex flex-col">
          <div className="max-w-4xl mx-auto w-full p-container-desktop flex-1">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="font-label-lg text-label-lg">
                  Question {current} of {examMeta.totalQuestions}
                </span>
                <span className="text-outline">/</span>
                <span className="font-label-lg text-label-lg">{question.section}</span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <span className="text-label-md font-label-md text-on-surface-variant uppercase">
                  {question.difficulty} Difficulty
                </span>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="font-title-lg text-title-lg text-on-surface leading-relaxed">
                {question.prompt}
              </h2>

              <div className="grid gap-stack-md py-4">
                {question.options.map((opt) => (
                  <ExamOption
                    key={opt.key}
                    option={opt}
                    name={`exam-option-${current}`}
                    selected={selectedKey === opt.key}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          </div>

          <footer className="sticky bottom-0 w-full bg-white border-t border-outline-variant px-container-desktop py-6 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={clearResponse}
                className="px-6 py-2 rounded-lg font-label-lg border border-outline text-on-surface hover:bg-surface-container-low transition-all"
              >
                Clear Response
              </button>
              <button
                type="button"
                onClick={toggleMarkForReview}
                className={[
                  'px-6 py-2 rounded-lg font-label-lg border flex items-center gap-2 transition-all',
                  marked.has(current)
                    ? 'border-secondary bg-secondary-container text-on-secondary-container'
                    : 'border-secondary text-secondary hover:bg-secondary-container/10',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-[18px]">bookmark</span>
                {marked.has(current) ? 'Marked for Review' : 'Mark for Review'}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={previous}
                disabled={current === 1}
                className="px-6 py-2 rounded-lg font-label-lg border border-outline text-on-surface hover:bg-surface-container-low transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={saveAndNext}
                disabled={current === examMeta.totalQuestions}
                className="bg-primary text-on-primary px-8 py-2 rounded-lg font-label-lg hover:opacity-90 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save &amp; Next
              </button>
            </div>
          </footer>
        </section>

        {/* Question palette (right sidebar) */}
        <aside className="w-80 bg-surface-container-low border-l border-outline-variant flex flex-col p-6 overflow-y-auto">
          {/* Profile mini card */}
          <div className="flex items-center gap-3 mb-8 bg-white p-3 rounded-xl shadow-sm border border-outline-variant">
            <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-title-lg">
              {currentStudent.initials}
            </div>
            <div>
              <p className="font-label-lg text-label-lg">{currentStudent.name}</p>
              <p className="text-[10px] text-outline font-bold">
                CANDIDATE ID: {currentStudent.id}
              </p>
            </div>
          </div>

          {/* Stats legend */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-primary" />
              <span className="text-label-md font-label-md">Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-surface-container-highest border border-outline-variant" />
              <span className="text-label-md font-label-md">Not Visited</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-secondary" />
              <span className="text-label-md font-label-md">Marked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm border-2 border-primary" />
              <span className="text-label-md font-label-md">Current</span>
            </div>
          </div>

          <div className="flex flex-col flex-1">
            <h3 className="font-label-lg text-label-lg mb-4 text-on-surface-variant uppercase tracking-widest">
              Question Palette
            </h3>
            <QuestionPalette
              total={examMeta.totalQuestions}
              state={paletteState}
              current={current}
              onSelect={selectFromPalette}
            />
          </div>

          {/* AI Proctor status */}
          <div className="mt-8 pt-6 border-t border-outline-variant">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="material-symbols-outlined text-secondary animate-pulse">
                  videocam
                </span>
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full border border-white" />
              </div>
              <div>
                <p className="text-label-md font-label-md">AI Proctoring Active</p>
                <p className="text-[10px] text-outline font-bold">REAL-TIME MONITORING</p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Anti-cheating monitoring pill */}
      <div
        style={{ opacity: monitoringOpacity, transition: 'opacity 0.3s ease' }}
        className="fixed bottom-24 right-container-desktop z-[60] flex items-center gap-3 bg-inverse-surface text-inverse-on-surface px-5 py-3 rounded-xl shadow-2xl border border-white/20 pointer-events-none backdrop-blur-md"
      >
        <div className="flex items-center justify-center w-2 h-2">
          <div className="w-2 h-2 bg-error rounded-full animate-pulse-red" />
        </div>
        <span className="font-label-lg text-label-lg tracking-wide">You are being monitored</span>
      </div>
    </div>
  );
}
