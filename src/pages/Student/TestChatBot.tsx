import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { STREAM_COLORS, STREAM_BG } from '../../lib/stream';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface TopicAcc { topic: string; subject?: string; pct: number; correct: number; total: number; }

interface BattlePlayer {
  uid: string; name: string; initials: string;
  score: number; correctCount: number; incorrectCount: number;
  skippedCount: number; accuracyPct: number; status: string;
}

interface TestResult {
  score?: number;
  correctCount?: number;
  incorrectCount?: number;
  skippedCount?: number;
  accuracyPct?: number;
  examTitle?: string;
  subject?: string;
  chapter?: string;
  subjects?: string[];
  chapters?: string[];
  topicAccuracy?: TopicAcc[];
  totalQuestions?: number;
  isBattle?: boolean;
  battleRank?: number;
  battleParticipants?: BattlePlayer[];
  // Feature 2 — exam-integrity telemetry from the browser-lock system
  integrity?: {
    lockMode?: 'open' | 'locked';
    tabSwitchCount?: number;
    timeOutsideSeconds?: number;
    lockViolations?: number;
  };
}

interface Message { id: number; role: 'ai' | 'user'; text: string; typing?: boolean; }

/* ── Gemini AI call ──────────────────────────────────────────────────────────── */

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

async function callGemini(userMessage: string, result: TestResult): Promise<string> {
  if (!GEMINI_KEY) throw new Error('No API key');

  const subjects = result.subjects?.length ? result.subjects : (result.subject ? [result.subject] : ['the tested subject']);
  const acc      = result.accuracyPct ?? 0;
  const correct  = result.correctCount ?? 0;
  const wrong    = result.incorrectCount ?? 0;
  const skipped  = result.skippedCount ?? 0;
  const total    = result.totalQuestions ?? correct + wrong + skipped;
  const isMulti  = subjects.length > 1;

  const topicLines = result.topicAccuracy?.length
    ? result.topicAccuracy.map(t => `  - ${t.topic} (${t.subject ?? subjects[0]}): ${t.pct}% accuracy, ${t.correct}/${t.total} correct`).join('\n')
    : `  - ${(result.chapters ?? result.chapter ? [result.chapter ?? ''] : subjects).join(', ')}: ${acc}% accuracy`;

  const systemPrompt = `You are a friendly, expert AI tutor for Indian competitive exam preparation (JEE/NEET).
A student just completed a ${isMulti ? 'multi-subject ' : ''}practice test. Here are their real results:
- Subjects: ${subjects.join(', ')}
- Total questions: ${total}
- Correct: ${correct}, Incorrect: ${wrong}, Skipped: ${skipped}
- Overall accuracy: ${acc}%

Per-topic breakdown:
${topicLines}

Answer the student's question in 2-4 short sentences. Reference their ACTUAL results across ALL subjects tested. Be specific, encouraging, and honest. Provide concrete, actionable advice relevant to the subjects/topics they studied.

Student's question: ${userMessage}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        // thinkingBudget: 0 keeps 2.5-flash from spending the token budget on
        // internal reasoning (which returns an empty answer for short replies).
        generationConfig: { maxOutputTokens: 700, temperature: 0.6, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response');
  return text.trim();
}

/* ── Smart context-aware fallback ────────────────────────────────────────────── */

function contextFallback(input: string, result: TestResult): string {
  const q        = input.toLowerCase();
  const subjects = result.subjects?.length ? result.subjects : (result.subject ? [result.subject] : ['this subject']);
  const subLabel = subjects.join(' + ');
  const acc      = result.accuracyPct ?? 0;
  const wrong    = result.incorrectCount ?? 0;
  const skipped  = result.skippedCount ?? 0;

  // Find weakest topic if multi-subject
  const weakest = result.topicAccuracy?.sort((a, b) => a.pct - b.pct)[0];
  const weakTopic = weakest ? `${weakest.topic} (${weakest.subject ?? subjects[0]}: ${weakest.pct}%)` : subLabel;

  if (q.includes('mistake') || q.includes('wrong') || q.includes('incorrect'))
    return `You got ${wrong} question${wrong !== 1 ? 's' : ''} wrong across ${subLabel}. Review each incorrect answer carefully — note the concept behind it. Focus especially on ${weakTopic}, which had the lowest accuracy.`;

  if (q.includes('skip') || q.includes('unattempt') || q.includes('blank'))
    return `You skipped ${skipped} question${skipped !== 1 ? 's' : ''} across your ${subLabel} test. In competitive exams, only skip when below 40% confident. Educated guesses on partially-known questions often pay off.`;

  if (q.includes('next') || q.includes('study') || q.includes('recommend') || q.includes('focus') || q.includes('improve')) {
    if (acc >= 80)
      return `You're performing strongly across ${subLabel}! To push further, solve timed past year questions and focus on Hard-level problems. Your overall accuracy is already above average.`;
    return `Based on your ${acc}% across ${subLabel}, I'd suggest: (1) Revisit the ${wrong} incorrect answers. (2) Focus on ${weakTopic} first. (3) Practice 15 questions daily per subject until you reach 75%+.`;
  }

  if (q.includes('which') || q.includes('subject') || q.includes('topic') || q.includes('focus'))
    return weakest
      ? `Your weakest area is ${weakest.topic} (${weakest.subject}) at ${weakest.pct}% — start there. ${subjects.length > 1 ? `Compare it with your stronger subjects and prioritise daily practice in the lowest-accuracy topics.` : ''}`
      : `Focus on the topics where you got the most wrong answers first. Revisit those concepts before moving on.`;

  if (q.includes('rank') || q.includes('percentile') || q.includes('position'))
    return `Based on ${acc}% overall accuracy across ${subLabel}, you're in the ${acc >= 80 ? 'top 15%' : acc >= 60 ? 'top 35%' : 'top 50%'} for these topics. Improving to 80%+ in all subjects will significantly move your rank.`;

  if (q.includes('time') || q.includes('speed') || q.includes('fast') || q.includes('slow'))
    return `For multi-subject tests, aim for under 2 minutes per question. Mark and skip if a question takes more than 3 minutes. Timed practice across ${subLabel} will build the speed and subject-switching skills you need.`;

  if (q.includes('plan') || q.includes('schedule') || q.includes('week'))
    return `Here's a suggested plan: Day 1–2 — revisit incorrect answers in ${subjects[0]}. Day 3–4 — ${subjects[1] ?? subjects[0]} revision and practice. Day 5–6 — mixed subject timed test. Day 7 — full-length revision. Repeat with increasing difficulty.`;

  if (q.includes('motivat') || q.includes('frustrat') || q.includes('feel') || q.includes('sad') || q.includes('discourag'))
    return `Getting ${acc}% across ${subLabel} takes real effort — that's something to build on, not feel down about. Every attempt reveals exactly what to improve. You've identified the gaps; closing them is just consistent practice.`;

  return `Your ${acc}% overall accuracy across ${subLabel} shows ${acc >= 70 ? 'solid understanding with room to sharpen' : 'clear areas to improve'}. Ask me which subject to focus on, what to study next, or how to build a study plan.`;
}

/* ── Welcome message ────────────────────────────────────────────────────────── */

function buildWelcome(result: TestResult, name: string): string {
  const acc      = result.accuracyPct ?? 0;
  const score    = result.score ?? result.correctCount ?? 0;
  const subjects = result.subjects?.length ? result.subjects : (result.subject ? [result.subject] : []);
  const isMulti  = subjects.length > 1;
  const context  = isMulti
    ? subjects.join(' + ')
    : (result.chapter ? `${result.subject} — ${result.chapter}` : (result.subject ?? 'your test'));

  if (acc >= 85)
    return `Outstanding work, ${name}! You scored ${score} with ${acc}% accuracy across ${context}. That's top-tier performance — keep the momentum. Ask me what to tackle next or how to push even higher.`;
  if (acc >= 70)
    return `Great job, ${name}! You scored ${score} with ${acc}% accuracy across ${context}. A few targeted tweaks will move you into the top tier. Ask me what to focus on next.`;
  if (acc >= 55)
    return `Good effort, ${name}! You scored ${score} with ${acc}% across ${context}. You're on the right track. Ask me where to focus and I'll build you a step-by-step plan.`;
  return `Hey ${name}, you scored ${score} with ${acc}% accuracy across ${context}. Every test is a learning opportunity — I can pinpoint exactly what to revise. Ask me anything and we'll build a comeback plan together.`;
}

/* ── Animated counter ───────────────────────────────────────────────────────── */

function useCountUp(target: number, startDelay = 400, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      let start: number | null = null;
      let frame: number;
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(eased * target));
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      return () => cancelAnimationFrame(frame);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [target, startDelay, duration]);
  return val;
}

/* ── SVG progress ring ──────────────────────────────────────────────────────── */

function ProgressRing({ pct, color, size = 160, strokeWidth = 13 }: {
  pct: number; color: string; size?: number; strokeWidth?: number;
}) {
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 500); return () => clearTimeout(t); }, []);
  const r    = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = go ? circ * (1 - Math.min(pct, 100) / 100) : circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

/* ── Confetti ───────────────────────────────────────────────────────────────── */

function Confetti({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);
  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [show]);
  if (!visible) return null;
  const COLORS = ['#5B4FE8', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#F472B6', '#60A5FA'];
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden' }}>
      {Array.from({ length: 56 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: `-${6 + (i % 6) * 4}px`, left: `${(i * 1.8 + 1.5) % 100}%`,
          width: `${5 + (i % 4) * 2}px`, height: `${5 + (i % 3) * 2}px`,
          borderRadius: i % 3 === 0 ? '50%' : '2px',
          backgroundColor: COLORS[i % COLORS.length],
          animation: `confettiFall ${1.5 + (i % 7) * 0.22}s ${(i * 0.055).toFixed(2)}s ease-in forwards`,
          transform: `rotate(${i * 43}deg)`, opacity: 0,
        }} />
      ))}
    </div>
  );
}

/* ── Verdict ────────────────────────────────────────────────────────────────── */

function getVerdict(acc: number) {
  if (acc >= 85) return { label: 'Outstanding!',  icon: 'emoji_events',  color: '#10B981', bg: 'linear-gradient(135deg, #059669, #10B981)', confetti: true };
  if (acc >= 70) return { label: 'Great Work!',   icon: 'thumb_up',      color: '#5B4FE8', bg: 'linear-gradient(135deg, #4338CA, #5B4FE8)', confetti: true };
  if (acc >= 55) return { label: 'Good Effort',   icon: 'trending_up',   color: '#F59E0B', bg: 'linear-gradient(135deg, #D97706, #F59E0B)', confetti: false };
  return            { label: 'Keep Pushing',     icon: 'fitness_center', color: '#EF4444', bg: 'linear-gradient(135deg, #DC2626, #EF4444)', confetti: false };
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export default function TestResultAndChat() {
  const location = useLocation();
  const result   = (location.state as TestResult | null) ?? {};
  const session  = getAuthSession();
  const name     = session?.user?.name?.split(' ')[0] ?? 'there';

  /* ─ Real computed values from actual test ─ */
  const correct  = result.correctCount   ?? 0;
  const wrong    = result.incorrectCount ?? 0;
  const skipped  = result.skippedCount   ?? 0;
  const total    = result.totalQuestions ?? (((correct + wrong + skipped) || 1));
  const acc      = result.accuracyPct    ?? Math.round((correct / total) * 100);
  const score    = result.score          ?? Math.max(0, correct * 4 - wrong);
  const subject  = result.subject  ?? '';
  const chapter  = result.chapter  ?? '';
  const verdict  = getVerdict(acc);

  /* ─ Single subject performance (only the chapter that was actually tested) ─ */
  const subjectColor = STREAM_COLORS[subject] ?? '#5B4FE8';
  const subjectBg    = STREAM_BG[subject]     ?? 'rgba(91,79,232,0.10)';

  /* ─ Animated values ─ */
  const animAcc   = useCountUp(acc, 400, 1500);
  const animScore = useCountUp(score, 500, 1500);

  /* ─ Chat state ─ */
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [chatReady, setChatReady] = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const nextId     = useRef(1);

  const allSubjects   = result.subjects?.length ? result.subjects : (subject ? [subject] : []);
  const isMultiSubject = allSubjects.length > 1;
  const subjectContext = isMultiSubject ? 'all subjects' : (chapter || subject);
  const suggestedQuestions = [
    'What did I get wrong?',
    'What should I study next?',
    `How can I improve in ${subjectContext}?`,
    isMultiSubject ? 'Which subject needs more attention?' : 'Any time management tips?',
    'Give me a study plan',
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setChatReady(true), 800);
    const t2 = setTimeout(() => {
      setMessages([{ id: nextId.current++, role: 'ai', text: buildWelcome(result, name) }]);
    }, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || busy) return;
    setInput('');
    setBusy(true);
    const userMsg:   Message = { id: nextId.current++, role: 'user', text: text.trim() };
    const typingMsg: Message = { id: nextId.current++, role: 'ai', text: '', typing: true };
    setMessages(prev => [...prev, userMsg, typingMsg]);

    let reply: string;
    try {
      reply = await callGemini(text, result);
    } catch {
      // Fallback to context-aware responses using real test data
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      reply = contextFallback(text, result);
    }

    setMessages(prev => prev.map(m => m.typing ? { ...m, text: reply, typing: false } : m));
    setBusy(false);
    inputRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  }

  const chatRef = useRef<HTMLDivElement>(null);
  function scrollToChat() { chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <Confetti show={verdict.confetti} />

      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-5 h-14"
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Concept Crack" className="w-7 h-7 rounded-lg object-cover" />
          <span className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {result.examTitle ?? 'Practice Test'} · Results
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={scrollToChat} className="btn-ghost btn-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#5B4FE8' }}>smart_toy</span>
            AI Tutor
          </button>
          <Link to={pathFor('analysis')} className="btn-outline btn-sm">Analysis</Link>
          <Link to={pathFor('student')} className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
            Dashboard
          </Link>
        </div>
      </header>

      {/* ── Results section ── */}
      <section className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Verdict banner */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: verdict.bg, animation: 'fadeSlideUp 0.5s ease both' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.20)' }}>
              <span className="material-symbols-outlined filled text-white" style={{ fontSize: '24px' }}>{verdict.icon}</span>
            </div>
            <div>
              <div className="text-xl font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{verdict.label}</div>
              <div className="text-sm text-white/75 mt-0.5">
                {result.examTitle ?? 'Practice Test'} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {result.integrity && (
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.20)', color: '#fff' }}
                    title="Browser-lock mode for this test"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                      {result.integrity.lockMode === 'locked' ? 'lock' : 'lock_open'}
                    </span>
                    {result.integrity.lockMode === 'locked' ? 'Locked' : 'Open'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: (result.integrity.tabSwitchCount ?? 0) > 0 ? 'rgba(245,158,11,0.30)' : 'rgba(255,255,255,0.20)', color: '#fff' }}
                    title="Number of times you left the exam window"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>tab</span>
                    {result.integrity.tabSwitchCount ?? 0} tab switch{(result.integrity.tabSwitchCount ?? 0) === 1 ? '' : 'es'}
                  </span>
                  {(result.integrity.timeOutsideSeconds ?? 0) > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.20)', color: '#fff' }}
                      title="Total time spent away from the exam"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                      {result.integrity.timeOutsideSeconds}s away
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Link
            to={pathFor('practice')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px"
            style={{ backgroundColor: 'rgba(255,255,255,0.20)', color: '#fff', border: '1px solid rgba(255,255,255,0.30)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            Practice Again
          </Link>
        </div>

        {/* Score hero + real stats */}
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', animation: 'fadeSlideUp 0.5s 0.1s ease both' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-8">

            {/* Ring */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative" style={{ width: 160, height: 160 }}>
                <ProgressRing pct={acc} color={verdict.color} size={160} />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: verdict.color }}>
                    {animAcc}%
                  </span>
                  <span className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Accuracy</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                  {animScore}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Total Score</div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Correct',   value: correct, color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: 'check_circle' },
                  { label: 'Incorrect', value: wrong,   color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  icon: 'cancel' },
                  { label: 'Skipped',   value: skipped, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', icon: 'remove_circle' },
                ].map((s, i) => (
                  <div key={s.label} className="rounded-xl p-4 flex items-center gap-3"
                    style={{ backgroundColor: s.bg, animation: `fadeSlideUp 0.45s ${0.15 + i * 0.08}s ease both` }}>
                    <span className="material-symbols-outlined filled" style={{ fontSize: '22px', color: s.color }}>{s.icon}</span>
                    <div>
                      <div className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: s.color }}>{s.value}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Per-topic performance — shows all chapters for multi-subject tests */}
              {(result.topicAccuracy?.length ?? 0) > 0 ? (
                <div style={{ animation: 'fadeSlideUp 0.45s 0.3s ease both' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>
                    Chapter Performance
                  </p>
                  {result.topicAccuracy!.map((t, i) => {
                    const tColor = STREAM_COLORS[t.subject ?? subject] ?? '#5B4FE8';
                    const tBg    = STREAM_BG[t.subject ?? subject]    ?? 'rgba(91,79,232,0.10)';
                    return (
                      <div key={i} className={i < result.topicAccuracy!.length - 1 ? 'mb-3' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tColor }} />
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.topic}</span>
                            {t.subject && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: tBg, color: tColor }}>
                                {t.subject}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold" style={{ color: t.pct >= 70 ? '#10B981' : t.pct >= 50 ? '#F59E0B' : '#EF4444' }}>
                            {t.pct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: tBg }}>
                          <SubjectBar pct={t.pct} color={tColor} delay={0.4 + i * 0.1} />
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
                          {t.correct} correct · {t.total - t.correct} not correct · {t.total} total
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : subject && (
                <div style={{ animation: 'fadeSlideUp 0.45s 0.3s ease both' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>
                    Chapter Performance
                  </p>
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subjectColor }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{chapter || subject}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: subjectBg, color: subjectColor }}>
                          {subject}
                        </span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: acc >= 70 ? '#10B981' : acc >= 50 ? '#F59E0B' : '#EF4444' }}>
                        {acc}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: subjectBg }}>
                      <SubjectBar pct={acc} color={subjectColor} delay={0.5} />
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
                      {correct} correct · {wrong} incorrect · {skipped} skipped · {total} total
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Performance summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ animation: 'fadeSlideUp 0.5s 0.5s ease both' }}>
          {/* What went well */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#10B981' }}>star</span>
              </div>
              <div>
                <div className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>What Went Well</div>
                <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Keep reinforcing these</div>
              </div>
            </div>
            {correct > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{chapter || subject}</span>
                  <span className="text-sm font-bold" style={{ color: '#10B981' }}>{correct}/{total} correct</span>
                </div>
                {acc >= 60 && (
                  <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                    You correctly solved {correct} out of {total} questions — solid understanding of {chapter || subject}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Work in progress — keep practising {chapter || subject}!</p>
            )}
          </div>

          {/* Areas to improve */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#F59E0B' }}>target</span>
              </div>
              <div>
                <div className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>Areas to Improve</div>
                <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Focus here for quick gains</div>
              </div>
            </div>
            {wrong > 0 || skipped > 0 ? (
              <div className="space-y-2">
                {wrong > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Incorrect answers</span>
                    <span className="text-sm font-bold" style={{ color: '#EF4444' }}>{wrong} questions</span>
                  </div>
                )}
                {skipped > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Skipped questions</span>
                    <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{skipped} questions</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: '18px', color: '#10B981' }}>verified</span>
                <span className="text-sm font-semibold" style={{ color: '#10B981' }}>Perfect score — outstanding!</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Battle leaderboard ── */}
        {result.isBattle && result.battleParticipants && result.battleParticipants.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', animation: 'fadeSlideUp 0.5s 0.6s ease both' }}>
            <div className="px-5 py-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, rgba(91,79,232,0.12), rgba(124,58,237,0.08))', borderBottom: '1px solid var(--border)' }}>
              <span className="material-symbols-outlined filled" style={{ fontSize: 20, color: '#F59E0B' }}>military_tech</span>
              <div>
                <div className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                  Battle Leaderboard
                  {result.battleRank === 1 && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>You won!</span>}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  You finished #{result.battleRank} of {result.battleParticipants.length}
                </div>
              </div>
            </div>
            {result.battleParticipants.map((p, i) => {
              const isMe = i + 1 === result.battleRank ||
                (result.battleParticipants!.length === 2 && p.score === (result.score ?? 0) && p.correctCount === (result.correctCount ?? 0));
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
              return (
                <div key={p.uid ?? i}
                  className={`flex items-center gap-4 px-5 py-4 ${i < result.battleParticipants!.length - 1 ? 'border-b' : ''}`}
                  style={{ borderColor: 'var(--border)', backgroundColor: isMe ? 'rgba(91,79,232,0.05)' : 'var(--surface)' }}>
                  <span className="text-base w-8 text-center shrink-0">{medal}</span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                    style={{ background: isMe ? 'linear-gradient(135deg, #5B4FE8, #7C3AED)' : 'linear-gradient(135deg, #6B7280, #9CA3AF)' }}>
                    {p.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {p.name} {isMe && <span className="text-xs font-normal" style={{ color: '#5B4FE8' }}>(you)</span>}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.correctCount}✓ &nbsp;{p.incorrectCount}✗ &nbsp;{p.skippedCount}—
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold" style={{ color: i === 0 ? '#F59E0B' : 'var(--text-primary)' }}>{p.score}</p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{p.accuracyPct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* ── Chat divider ── */}
      <div ref={chatRef} className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
              <span className="material-symbols-outlined filled text-white" style={{ fontSize: '13px' }}>smart_toy</span>
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Ask Your AI Tutor
            </span>
          </div>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>
      </div>

      {/* ── Chat section ── */}
      <section className="max-w-5xl mx-auto px-4 pb-8"
        style={{ opacity: chatReady ? 1 : 0, transition: 'opacity 0.6s ease', minHeight: 400 }}>

        <div className="space-y-4 py-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
              {msg.role === 'ai' ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                  style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                  <span className="material-symbols-outlined filled text-white" style={{ fontSize: '15px' }}>smart_toy</span>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                style={msg.role === 'ai'
                  ? { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }
                  : { background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', color: '#fff' }
                }
              >
                {msg.typing ? (
                  <div className="flex items-center gap-1 py-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--text-faint)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                ) : msg.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggested questions */}
        {messages.filter(m => m.role === 'user').length === 0 && messages.length > 0 && (
          <div className="pb-3">
            <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map(q => (
                <button key={q} onClick={() => void sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all hover:-translate-y-px"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="sticky bottom-0 pt-3 pb-2" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <span className="material-symbols-outlined filled shrink-0" style={{ fontSize: '18px', color: '#5B4FE8' }}>smart_toy</span>
            <input
              ref={inputRef}
              type="text"
              placeholder={`Ask about your ${isMultiSubject ? allSubjects.join(' + ') : (chapter || subject)} performance, what to study next…`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={busy || !chatReady}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || busy || !chatReady}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', flexShrink: 0 }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>send</span>
            </button>
          </div>
          <p className="text-center text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
            AI responses are personalised based on your {isMultiSubject ? allSubjects.join(' + ') : (chapter || subject)} test performance.
          </p>
        </div>
      </section>

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          85%  { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%           { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

/* ── Animated subject bar ── */

function SubjectBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const [width, setWidth] = useState('0%');
  useEffect(() => {
    const t = setTimeout(() => setWidth(`${pct}%`), delay * 1000);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="h-full rounded-full"
      style={{ width, backgroundColor: color, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
  );
}
