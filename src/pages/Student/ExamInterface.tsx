import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { getAuthSession } from '../../lib/auth';
import { updateStudentProgress } from '../../lib/db';
import {
  currentStudent,
  examMeta,
  genExamQuestions,
  type ExamOption as ExamOptionType,
  type ExamMeta,
} from '../../mocks/student';
import { getQuestionsForChapter, getQuestionsByIds, type ExamQuestion as FirestoreQuestion } from '../../lib/questions';
import { getTest, saveTestAttempt } from '../../lib/tests';
import { updateWeakTopics } from '../../lib/weakTopics';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';

const fallbackMeta = examMeta;

type PaletteState = 'not-visited' | 'answered' | 'marked' | 'not-answered';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const PALETTE_STYLES: Record<PaletteState, { bg: string; color: string; border: string }> = {
  'not-visited':  { bg: 'var(--border)',    color: 'var(--text-muted)',    border: 'var(--border)' },
  'answered':     { bg: '#10B981',          color: '#fff',                 border: '#10B981' },
  'marked':       { bg: '#F59E0B',          color: '#fff',                 border: '#F59E0B' },
  'not-answered': { bg: '#EF4444',          color: '#fff',                 border: '#EF4444' },
};

export default function ExamInterface() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const toast     = useToast();

  // State from PracticeModule (subject/chapter) or test-based (testId)
  const { subject: stateSubject = 'Physics', chapter: stateChapter = '', testId = null, examTitle: stateTitle = '' } =
    (location.state ?? {}) as { subject?: string; chapter?: string; testId?: string | null; examTitle?: string };
  const [subject, setSubject]             = useState(stateSubject);
  const [chapter, setChapter]             = useState(stateChapter);
  const [testSubjects, setTestSubjects]   = useState<string[]>([]);
  const [testChapters, setTestChapters]   = useState<string[]>([]);

  const [exam, setExam]             = useState<ExamMeta>(fallbackMeta);
  const [questions, setQuestions]   = useState<FirestoreQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [seconds, setSeconds]       = useState(fallbackMeta.durationSeconds);
  const [current, setCurrent]       = useState(1);
  const [answers, setAnswers]       = useState<Record<number, ExamOptionType['key']>>({});
  const [marked, setMarked]         = useState<Set<number>>(new Set());
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [monitorOpacity, setMonitorOpacity] = useState(0.5);
  const [paletteState, setPaletteState] = useState<Record<number, PaletteState>>({});

  // Timer countdown
  useEffect(() => {
    if (seconds <= 0) { void submitExam(); return; }
    const id = window.setInterval(() => setSeconds(s => s > 0 ? s - 1 : 0), 1000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  // Anti-cheat: right-click + Ctrl+C/V/I blocking
  useEffect(() => {
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'i'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        toast('Action restricted — Concept Crack maintains strict exam integrity.', 'error');
      }
    };
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKey);
    };
  }, [toast]);

  // Monitor opacity on mouse move
  useEffect(() => {
    let timeout: number | undefined;
    const onMove = () => {
      setMonitorOpacity(1);
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setMonitorOpacity(0.5), 3000);
    };
    document.addEventListener('mousemove', onMove);
    return () => { document.removeEventListener('mousemove', onMove); if (timeout) window.clearTimeout(timeout); };
  }, []);

  // Load questions from Firestore — by testId or by subject/chapter
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let qs: FirestoreQuestion[] = [];
      let titleOverride = stateTitle;

      if (testId) {
        try {
          const test = await getTest(testId);
          if (test && test.questionIds.length > 0) {
            qs = await getQuestionsByIds(test.questionIds);
            if (!titleOverride) titleOverride = test.title;
            if (test.subjects.length > 0) { setTestSubjects(test.subjects); setSubject(test.subjects[0]); }
            if (test.chapters.length > 0) { setTestChapters(test.chapters); setChapter(test.chapters[0]); }
            if (!cancelled && qs.length > 0) {
              const meta: ExamMeta = {
                id: test.id.slice(0, 30),
                title: test.title,
                totalQuestions: qs.length,
                currentIndex: 1,
                durationSeconds: test.durationSeconds,
                candidateId: currentStudent.id,
              };
              setExam(meta);
              setSeconds(test.durationSeconds);
              setCurrent(1);
              setQuestions(qs);
              setPaletteState(Object.fromEntries(qs.map((_, i) => [i + 1, 'not-visited' as PaletteState])));
              setLoading(false);
              return;
            }
          }
        } catch { /* fall through */ }
      }

      if (qs.length === 0 && chapter) {
        try {
          qs = await getQuestionsForChapter(subject, chapter, 30);
        } catch { /* fall through */ }
      }

      if (cancelled) return;

      if (qs.length > 0) {
        const durationSeconds = qs.length * 90;
        const meta: ExamMeta = {
          id:              `${subject}-${chapter}`.slice(0, 30),
          title:           titleOverride || `${subject}: ${chapter}`,
          totalQuestions:  qs.length,
          currentIndex:    1,
          durationSeconds,
          candidateId:     currentStudent.id,
        };
        setExam(meta);
        setSeconds(durationSeconds);
        setCurrent(1);
        setQuestions(qs);
        setPaletteState(Object.fromEntries(qs.map((_, i) => [i + 1, 'not-visited' as PaletteState])));
      } else {
        const mockQs = genExamQuestions(fallbackMeta.totalQuestions);
        setExam(fallbackMeta);
        setSeconds(fallbackMeta.durationSeconds);
        setCurrent(1);
        setQuestions(mockQs as unknown as FirestoreQuestion[]);
        setPaletteState(Object.fromEntries(Array.from({ length: fallbackMeta.totalQuestions }, (_, i) => [i + 1, 'not-visited' as PaletteState])));
      }

      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, subject, chapter]);

  const question   = questions[current - 1];
  const selectedKey = answers[current] ?? null;
  const answered   = Object.keys(answers).length;
  const reviewCount = marked.size;

  const timerClass = seconds <= 300 ? 'danger' : seconds <= 600 ? 'warning' : '';

  function onSelect(key: ExamOptionType['key']) {
    setAnswers(prev => ({ ...prev, [current]: key }));
    setPaletteState(prev => ({ ...prev, [current]: 'answered' }));
    if (sessionId) {
      void apiRequest(`/api/exams/sessions/${sessionId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({ questionId: current, answer: key }),
      }).catch(() => undefined);
    }
  }

  function clearResponse() {
    setAnswers(prev => { const next = { ...prev }; delete next[current]; return next; });
    setPaletteState(prev => ({ ...prev, [current]: 'not-visited' }));
    if (sessionId) {
      void apiRequest(`/api/exams/sessions/${sessionId}/clear`, { method: 'PATCH', body: JSON.stringify({ questionId: current }) }).catch(() => undefined);
    }
  }

  function toggleMark() {
    setMarked(prev => {
      const next = new Set(prev);
      const wasMarked = next.has(current);
      if (wasMarked) {
        next.delete(current);
        setPaletteState(p => ({ ...p, [current]: answers[current] ? 'answered' : 'not-visited' }));
      } else {
        next.add(current);
        setPaletteState(p => ({ ...p, [current]: 'marked' }));
      }
      if (sessionId) {
        void apiRequest(`/api/exams/sessions/${sessionId}/mark`, { method: 'PATCH', body: JSON.stringify({ questionId: current, marked: !wasMarked }) }).catch(() => undefined);
      }
      return next;
    });
  }

  function saveAndNext() { setCurrent(c => Math.min(exam.totalQuestions, c + 1)); }
  function previous()    { setCurrent(c => Math.max(1, c - 1)); }

  async function submitExam() {
    let apiResult: Record<string, unknown> = {};
    if (sessionId) {
      try {
        apiResult = await apiRequest(`/api/exams/sessions/${sessionId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }) as Record<string, unknown>;
      } catch { /* continue */ }
    }

    // Per-chapter AND overall stats — uses question.subject/chapter from Firestore
    let correctCount = 0;
    let incorrectCount = 0;
    const diffStats: Record<string, { correct: number; total: number }> = {};
    const chapterStats: Record<string, { subject: string; chapter: string; correct: number; incorrect: number; total: number }> = {};

    questions.forEach((q, i) => {
      const qNum     = i + 1;
      const diff     = q.difficulty || 'Medium';
      const qSubject = q.subject || subject;
      const qChapter = q.chapter || q.section || chapter || 'Unknown';
      const key      = `${qSubject}::${qChapter}`;

      if (!diffStats[diff]) diffStats[diff] = { correct: 0, total: 0 };
      diffStats[diff].total++;
      if (!chapterStats[key]) chapterStats[key] = { subject: qSubject, chapter: qChapter, correct: 0, incorrect: 0, total: 0 };
      chapterStats[key].total++;

      if (answers[qNum] !== undefined) {
        if (q.answer && answers[qNum] === q.answer) {
          correctCount++;
          diffStats[diff].correct++;
          chapterStats[key].correct++;
        } else {
          incorrectCount++;
          chapterStats[key].incorrect++;
        }
      }
    });

    const skippedCount = exam.totalQuestions - correctCount - incorrectCount;
    const accuracyPct  = exam.totalQuestions > 0 ? Math.round((correctCount / exam.totalQuestions) * 100) : 0;
    const score        = (apiResult.score as number) ?? Math.max(0, correctCount * 4 - incorrectCount);
    const safePct      = (c: number, t: number) => t > 0 ? Math.round(c / t * 100) : 0;
    const timeMinutes  = Math.max(1, Math.round((exam.durationSeconds - seconds) / 60));

    // Build per-topic accuracy array (one entry per chapter)
    const topicAccuracy = Object.values(chapterStats).map(s => ({
      topic:   s.chapter,
      subject: s.subject,
      pct:     s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      correct: s.correct,
      total:   s.total,
    }));

    // All subjects/chapters from the test
    const allSubjects = testSubjects.length > 0 ? testSubjects : [subject];
    const allChapters = testChapters.length > 0 ? testChapters : topicAccuracy.map(t => t.topic);

    const uid = getAuthSession()?.user?.id;

    // Update weak topics for every chapter attempted
    if (uid) {
      void updateWeakTopics(uid, Object.values(chapterStats).map(s => ({
        subject: s.subject, chapter: s.chapter, correct: s.correct, incorrect: s.incorrect,
      })));
    }

    if (uid && testId) {
      void saveTestAttempt({
        testId,
        studentId:     uid,
        answers:       Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v as 'A'|'B'|'C'|'D'])),
        score, correctCount, incorrectCount, skippedCount, accuracyPct,
        timeSeconds:   exam.durationSeconds - seconds,
        status:        'submitted',
        startedAt:     new Date().toISOString(),
        submittedAt:   new Date().toISOString(),
      });
    }

    if (uid) {
      void updateStudentProgress(uid, {
        lastActivity: {
          type:        'test',
          title:       exam.title,
          score:       accuracyPct,
          accuracy:    accuracyPct,
          completedAt: new Date().toISOString(),
        },
        completedTests: 1,
        latestTestResult: {
          testTitle:      exam.title,
          testDate:       new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          subject,
          chapter,
          subjects:       allSubjects,
          chapters:       allChapters,
          totalQuestions: exam.totalQuestions,
          correctCount,
          incorrectCount,
          skippedCount,
          accuracyPct,
          score,
          timeMinutes,
          easyPct:   safePct(diffStats['Easy']?.correct   ?? 0, diffStats['Easy']?.total   ?? 0),
          mediumPct: safePct(diffStats['Medium']?.correct ?? 0, diffStats['Medium']?.total ?? 0),
          hardPct:   safePct(diffStats['Hard']?.correct   ?? 0, diffStats['Hard']?.total   ?? 0),
          topicAccuracy,
        },
      });
    }

    navigate(pathFor('chatbot'), {
      state: {
        score, correctCount, incorrectCount, skippedCount, accuracyPct,
        examTitle:      exam.title,
        subject,
        chapter,
        subjects:       allSubjects,
        chapters:       allChapters,
        topicAccuracy,
        totalQuestions: exam.totalQuestions,
      },
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: '#5B4FE8', borderTopColor: 'transparent' }} />
          <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>Loading questions…</p>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)', userSelect: 'none' }}
    >
      {/* ── Top bar ── */}
      <header
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 h-16"
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', zIndex: 50 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Concept Crack" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>Concept Crack</span>
          </div>
          <div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{exam.title}</div>
            <div className="text-xs" style={{ color: 'var(--text-faint)', letterSpacing: '0.05em' }}>SESSION: {exam.id}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress mini */}
          <div className="hidden md:flex items-center gap-4 text-xs font-semibold px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
            <span><span style={{ color: '#10B981' }}>{answered}</span> answered</span>
            <span><span style={{ color: '#F59E0B' }}>{reviewCount}</span> flagged</span>
            <span><span style={{ color: '#EF4444' }}>{exam.totalQuestions - answered - reviewCount}</span> remaining</span>
          </div>

          {/* Timer */}
          <div
            className={`exam-timer ${timerClass}`}
            aria-live="polite"
            aria-label={`Time remaining: ${formatTime(seconds)}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>timer</span>
            <span className="font-mono font-bold" style={{ letterSpacing: '0.06em' }}>{formatTime(seconds)}</span>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Submit exam? This action cannot be undone.')) void submitExam();
            }}
            className="btn-primary btn-md"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
            Submit
          </button>
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex pt-16 h-screen overflow-hidden">
        {/* Question area */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {/* Question meta */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                  >
                    {current}
                  </span>
                  <div>
                    <div className="text-body-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                      Question {current} of {exam.totalQuestions}
                    </div>
                    <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{question.section ?? 'General'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-label-sm font-bold px-3 py-1 rounded-full"
                    style={
                      question.difficulty === 'Hard'   ? { backgroundColor: 'rgba(239,68,68,0.10)', color: '#EF4444' } :
                      question.difficulty === 'Medium' ? { backgroundColor: 'rgba(245,158,11,0.10)', color: '#B45309' } :
                      { backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }
                    }
                  >
                    {question.difficulty}
                  </span>
                  {marked.has(current) && (
                    <span className="text-label-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.10)', color: '#B45309' }}>
                      Flagged
                    </span>
                  )}
                </div>
              </div>

              {/* Question text */}
              <div
                className="rounded-xl p-6 mb-6 text-base leading-relaxed"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '16px', lineHeight: '1.7' }}
              >
                {question.prompt}
              </div>

              {/* Options */}
              <div className="space-y-3">
                {question.options.map((opt: any) => {
                  const isSelected = selectedKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => onSelect(opt.key)}
                      className="w-full text-left transition-all duration-150"
                      style={{
                        borderRadius: '10px',
                        border: `1.5px solid ${isSelected ? '#5B4FE8' : 'var(--border)'}`,
                        backgroundColor: isSelected ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 3px rgba(91,79,232,0.12)' : 'var(--shadow-xs)',
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                        style={{
                          backgroundColor: isSelected ? '#5B4FE8' : 'var(--surface-muted)',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          border: isSelected ? 'none' : '1.5px solid var(--border)',
                        }}
                      >
                        {opt.key}
                      </div>
                      <span
                        className="text-base"
                        style={{ color: isSelected ? '#5B4FE8' : 'var(--text-primary)', fontWeight: isSelected ? 500 : 400 }}
                      >
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <footer
            className="shrink-0 flex items-center justify-between px-6 py-4"
            style={{ backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearResponse}
                className="btn-ghost btn-md"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
                Clear
              </button>
              <button
                type="button"
                onClick={toggleMark}
                className={`btn-md ${marked.has(current) ? '' : 'btn-outline'}`}
                style={marked.has(current) ? { backgroundColor: 'rgba(245,158,11,0.12)', color: '#B45309', border: '1px solid rgba(245,158,11,0.30)' } : undefined}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {marked.has(current) ? 'bookmark' : 'bookmark_add'}
                </span>
                {marked.has(current) ? 'Flagged' : 'Flag for Review'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={previous}
                disabled={current === 1}
                className="btn-outline btn-md"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                Previous
              </button>
              <button
                type="button"
                onClick={saveAndNext}
                disabled={current === exam.totalQuestions}
                className="btn-primary btn-md"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              >
                Save & Next
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>
          </footer>
        </main>

        {/* Question palette sidebar */}
        <aside
          className="w-72 shrink-0 flex flex-col overflow-y-auto"
          style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        >
          {/* Student info */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="avatar avatar-md">{currentStudent.initials}</div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{currentStudent.name}</div>
                <div className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>ID: {currentStudent.id}</div>
              </div>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Done', count: answered, color: '#10B981' },
                { label: 'Flag', count: reviewCount, color: '#F59E0B' },
                { label: 'Left', count: exam.totalQuestions - answered - reviewCount, color: '#EF4444' },
              ].map(s => (
                <div key={s.label} className="py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)' }}>
                  <div className="text-lg font-bold font-headline" style={{ color: s.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.count}</div>
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                { state: 'not-visited',  label: 'Not visited' },
                { state: 'answered',     label: 'Answered' },
                { state: 'marked',       label: 'Flagged' },
                { state: 'not-answered', label: 'Not answered' },
              ].map(({ state, label }) => {
                const s = PALETTE_STYLES[state as PaletteState];
                return (
                  <div key={state} className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: s.bg }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Palette grid */}
          <div className="flex-1 p-4">
            <p className="text-overline uppercase mb-3" style={{ color: 'var(--text-faint)' }}>Question Palette</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: exam.totalQuestions }, (_, i) => {
                const qn = i + 1;
                const state = paletteState[qn] ?? 'not-visited';
                const styles = PALETTE_STYLES[state];
                const isCurrent = qn === current;
                return (
                  <button
                    key={qn}
                    type="button"
                    onClick={() => setCurrent(qn)}
                    className="palette-btn"
                    aria-label={`Question ${qn}, ${state}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    style={{
                      backgroundColor: styles.bg,
                      color: styles.color,
                      outline: isCurrent ? `2px solid #5B4FE8` : 'none',
                      outlineOffset: '2px',
                    }}
                  >
                    {qn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Proctor */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: '#EF4444' }} />
              <div>
                <div className="text-label-sm font-semibold" style={{ color: '#DC2626' }}>AI Proctoring Active</div>
                <div className="text-[10px]" style={{ color: '#EF4444' }}>Real-time monitoring enabled</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Monitoring pill */}
      <div
        className="fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-2.5 rounded-xl pointer-events-none"
        style={{
          opacity: monitorOpacity,
          transition: 'opacity 0.3s ease',
          backgroundColor: '#111827',
          color: '#F9FAFB',
          boxShadow: '0 8px 32px rgba(0,0,0,0.40)',
          zIndex: 60,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#EF4444' }} />
        <span className="text-sm font-semibold">You are being monitored</span>
      </div>
    </div>
  );
}
