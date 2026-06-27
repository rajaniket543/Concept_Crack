import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream, getStreamSubjects, STREAM_COLORS, STREAM_BG } from '../../lib/stream';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface TestResult {
  score?: number;
  correctCount?: number;
  incorrectCount?: number;
  skippedCount?: number;
  accuracyPct?: number;
  examTitle?: string;
}

interface Message { id: number; role: 'ai' | 'user'; text: string; typing?: boolean; }

/* ── AI response engine ─────────────────────────────────────────────────────── */

function buildWelcome(result: TestResult, name: string): string {
  const total = ((result.correctCount ?? 0) + (result.incorrectCount ?? 0) + (result.skippedCount ?? 0)) || 1;
  const acc = result.accuracyPct ?? Math.round(((result.correctCount ?? 0) / total) * 100);
  const score = result.score ?? result.correctCount ?? 0;
  if (acc >= 85)
    return `Outstanding work, ${name}! 🎉 You scored ${score} with ${acc}% accuracy — that's top-tier performance. Your preparation is clearly paying off. Ask me anything about your results, what to study next, or how to push even higher.`;
  if (acc >= 70)
    return `Great job, ${name}! You scored ${score} with ${acc}% accuracy — solid performance. A few targeted tweaks will push you into the top tier. Ask me what to focus on or let's talk through the topics you found tricky.`;
  if (acc >= 55)
    return `Good effort, ${name}! You scored ${score} with ${acc}% accuracy. You're on the right track — there's a clear path to improvement. Ask me where to focus, and I'll build you a step-by-step recovery plan.`;
  return `Hey ${name}, you scored ${score} with ${acc}% accuracy. Every test is a learning opportunity — I can pinpoint exactly what to revise. Ask me anything and we'll put together a comeback plan together.`;
}

function getAIResponse(input: string, result: TestResult): string {
  const q     = input.toLowerCase();
  const acc   = result.accuracyPct ?? 70;
  const wrong = result.incorrectCount ?? 0;
  const skip  = result.skippedCount ?? 0;

  if (q.includes('mistake') || q.includes('wrong') || q.includes('incorrect') || q.includes('error'))
    return `You got ${wrong} questions wrong in this test. The most common pattern I see is rushing through medium-difficulty questions without re-reading the options. Try spending 10–15 extra seconds on each option before finalising. Focus on the topics from Section B — those had the most errors.`;
  if (q.includes('skip') || q.includes('unattempt') || q.includes('blank'))
    return `You left ${skip} questions unattempted. In competitive exams with negative marking, strategic skipping is fine — but some of those skipped questions were in areas where you've shown strength before. Next time, attempt ones you're 60%+ confident on.`;
  if (q.includes('next') || q.includes('study') || q.includes('recommend') || q.includes('focus') || q.includes('improve')) {
    if (acc >= 80)
      return `You're performing strongly. To push from this level to the top 1%, focus on: (1) Speed — solve 10 harder problems per day under timed conditions. (2) Accuracy on Hard questions — that's where ranks are decided. (3) Revise Organic Chemistry and Wave Optics, which showed slight dips. Keep it up!`;
    return `Based on your performance, here's your 3-step improvement plan:\n\n1. **Revise Weak Topics** — Circular Motion, Wave Optics, and Organic Synthesis showed the lowest accuracy. Spend 2 sessions each.\n2. **Practice Medium Questions** — Your medium-difficulty accuracy (${Math.round(acc * 0.85)}%) needs a lift. Attempt 15 per day.\n3. **Full-length mocks** — Take one per week. Time management was slightly off this attempt.`;
  }
  if (q.includes('rank') || q.includes('percentile') || q.includes('position'))
    return `Based on this test score, you're approximately in the ${acc >= 85 ? 'top 10%' : acc >= 70 ? 'top 25%' : 'top 40%'} of your batch. Consistent improvement over the next 4 weeks can move you up significantly — each 5% improvement in accuracy typically shifts rank by 20–30 positions.`;
  if (q.includes('time') || q.includes('speed') || q.includes('fast') || q.includes('slow'))
    return `Time management is key. Aim for: Physics — 40 min, Chemistry — 35 min, Math/Biology — 45 min. If you're spending more than 3 minutes on a single question, skip and return. Practice solving 20 questions in 30 minutes daily to build speed without sacrificing accuracy.`;
  if (q.includes('motivat') || q.includes('discourag') || q.includes('frustrat') || q.includes('feel') || q.includes('sad'))
    return `It's completely normal to feel this way — every serious aspirant goes through this phase. The fact that you're here, reviewing your performance after a test, already puts you ahead of 70% of your peers. Progress isn't always linear. You've improved since your last test. You've got this. 💪`;
  if (q.includes('physics') || q.includes('chem') || q.includes('math') || q.includes('bio')) {
    const sub = q.includes('physics') ? 'Physics' : q.includes('chem') ? 'Chemistry' : q.includes('bio') ? 'Biology' : 'Mathematics';
    return `For ${sub}, your accuracy suggests you're strong on conceptual questions but struggle with numerical applications. My recommendation: (1) Solve 10 previous year JEE/NEET ${sub} questions daily. (2) Watch short concept videos on weak chapters. (3) Create a formula sheet and review it every night for 10 minutes.`;
  }
  if (q.includes('hello') || q.includes('hi') || q.includes('hey'))
    return `Hi there! I'm your AI tutor. I've analysed your test results and I'm ready to help. You can ask me about your mistakes, what to study next, time management tips, or anything else about your preparation. What's on your mind?`;
  return `That's a great question. Based on your ${acc}% accuracy, the most impactful thing you can do right now is focus on consolidating medium-difficulty topics where small errors are costing you the most marks. Would you like a specific study plan, topic recommendations, or to talk through a particular question type?`;
}

/* ── Animated counter hook ──────────────────────────────────────────────────── */

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

/* ── Animated SVG progress ring ─────────────────────────────────────────────── */

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

/* ── Confetti burst ─────────────────────────────────────────────────────────── */

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
          position: 'absolute',
          top: `-${6 + (i % 6) * 4}px`,
          left: `${(i * 1.8 + 1.5) % 100}%`,
          width:  `${5 + (i % 4) * 2}px`,
          height: `${5 + (i % 3) * 2}px`,
          borderRadius: i % 3 === 0 ? '50%' : '2px',
          backgroundColor: COLORS[i % COLORS.length],
          animation: `confettiFall ${1.5 + (i % 7) * 0.22}s ${(i * 0.055).toFixed(2)}s ease-in forwards`,
          transform: `rotate(${i * 43}deg)`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

/* ── Verdict config ─────────────────────────────────────────────────────────── */

function getVerdict(acc: number) {
  if (acc >= 85) return { label: 'Outstanding!',   icon: 'emoji_events',  color: '#10B981', bg: 'linear-gradient(135deg, #059669, #10B981)', confetti: true };
  if (acc >= 70) return { label: 'Great Work!',    icon: 'thumb_up',      color: '#5B4FE8', bg: 'linear-gradient(135deg, #4338CA, #5B4FE8)', confetti: true };
  if (acc >= 55) return { label: 'Good Effort',    icon: 'trending_up',   color: '#F59E0B', bg: 'linear-gradient(135deg, #D97706, #F59E0B)', confetti: false };
  return             { label: 'Keep Pushing',      icon: 'fitness_center', color: '#EF4444', bg: 'linear-gradient(135deg, #DC2626, #EF4444)', confetti: false };
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export default function TestResultAndChat() {
  const location = useLocation();
  const result   = (location.state as TestResult | null) ?? {};
  const session  = getAuthSession();
  const name     = session?.user?.name?.split(' ')[0] ?? 'there';
  const stream   = getStudentStream();
  const subjects = getStreamSubjects(stream);

  /* ─ Computed values ─ */
  const correct   = result.correctCount   ?? 0;
  const wrong     = result.incorrectCount ?? 0;
  const skipped   = result.skippedCount   ?? 0;
  const total     = correct + wrong + skipped || 50;
  const acc       = result.accuracyPct ?? (Math.round((correct / total) * 100) || 0);
  const score     = result.score ?? correct * 4;
  const verdict   = getVerdict(acc);

  /* ─ Subject-wise performance (derived with deterministic variance) ─ */
  const subjectPerf = subjects.map((s, i) => {
    const offsets = [
      Math.round(Math.sin(acc * 0.31 + i)       * 14),
      Math.round(Math.cos(acc * 0.47 + i * 1.3) * 10),
      Math.round(Math.sin(acc * 0.61 + i * 2.1) * 16),
    ];
    const pct = Math.max(12, Math.min(100, acc + (offsets[i] ?? 0)));
    return { subject: s, pct, color: STREAM_COLORS[s] ?? '#5B4FE8', bg: STREAM_BG[s] ?? 'rgba(91,79,232,0.10)' };
  });

  const mean      = Math.round(subjectPerf.reduce((a, s) => a + s.pct, 0) / subjectPerf.length);
  const strengths = subjectPerf.filter(s => s.pct >= mean);
  const improve   = subjectPerf.filter(s => s.pct < mean);

  /* ─ Animated values ─ */
  const animAcc   = useCountUp(acc, 400, 1500);
  const animScore = useCountUp(score, 500, 1500);

  /* ─ Chat state ─ */
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [chatReady, setChatReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const nextId    = useRef(1);

  const suggestedQuestions = [
    'What did I get wrong?',
    'What should I study next?',
    'How can I improve my rank?',
    'Any time management tips?',
    'How was my performance?',
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
    await new Promise(r => setTimeout(r, 900 + Math.random() * 500));
    const reply = getAIResponse(text, result);
    setMessages(prev => prev.map(m => m.typing ? { ...m, text: reply, typing: false } : m));
    setBusy(false);
    inputRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  }

  /* ─ Scroll to chat ─ */
  const chatRef = useRef<HTMLDivElement>(null);
  function scrollToChat() { chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <Confetti show={verdict.confetti} />

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-5 h-14"
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Concept Crack" className="w-7 h-7 rounded-lg object-cover" />
          <div>
            <span className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {result.examTitle ?? 'Mock Test'} · Results
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={scrollToChat}
            className="btn-ghost btn-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#5B4FE8' }}>smart_toy</span>
            AI Tutor
          </button>
          <Link to={pathFor('analysis')} className="btn-outline btn-sm">Analysis</Link>
          <Link to={pathFor('student')}  className="btn-primary btn-sm"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>Dashboard</Link>
        </div>
      </header>

      {/* ── Results section ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Verdict banner */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: verdict.bg, animation: 'fadeSlideUp 0.5s ease both' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.20)' }}
            >
              <span className="material-symbols-outlined filled text-white" style={{ fontSize: '24px' }}>
                {verdict.icon}
              </span>
            </div>
            <div>
              <div className="text-xl font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {verdict.label}
              </div>
              <div className="text-sm text-white/75 mt-0.5">
                {result.examTitle ?? 'Mock Test'} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={pathFor('exam')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px"
              style={{ backgroundColor: 'rgba(255,255,255,0.20)', color: '#fff', border: '1px solid rgba(255,255,255,0.30)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
              Retake
            </Link>
          </div>
        </div>

        {/* Score hero + stats */}
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', animation: 'fadeSlideUp 0.5s 0.1s ease both' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-8">

            {/* Ring */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative" style={{ width: 160, height: 160 }}>
                <ProgressRing pct={acc} color={verdict.color} size={160} />
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
                  style={{ transform: 'none' }}
                >
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

            {/* Stat grid */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Correct',   value: correct, color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: 'check_circle' },
                  { label: 'Incorrect', value: wrong,   color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  icon: 'cancel' },
                  { label: 'Skipped',   value: skipped, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', icon: 'remove_circle' },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-4 flex items-center gap-3"
                    style={{ backgroundColor: s.bg, animation: `fadeSlideUp 0.45s ${0.15 + i * 0.08}s ease both` }}
                  >
                    <span className="material-symbols-outlined filled" style={{ fontSize: '22px', color: s.color }}>{s.icon}</span>
                    <div>
                      <div className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: s.color }}>{s.value}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subject bars */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>
                  Subject-wise Performance
                </p>
                {subjectPerf.map((s, i) => (
                  <div key={s.subject} style={{ animation: `fadeSlideUp 0.45s ${0.3 + i * 0.1}s ease both` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: s.pct >= 70 ? '#10B981' : s.pct >= 50 ? '#F59E0B' : '#EF4444' }}>
                        {s.pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: s.bg }}>
                      <SubjectBar pct={s.pct} color={s.color} delay={0.5 + i * 0.12} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strengths & Improve */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ animation: 'fadeSlideUp 0.5s 0.5s ease both' }}>
          {/* Strengths */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#10B981' }}>star</span>
              </div>
              <div>
                <div className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>Your Strengths</div>
                <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Keep reinforcing these</div>
              </div>
            </div>
            <div className="space-y-2">
              {strengths.length > 0 ? strengths.map(s => (
                <div key={s.subject} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                  <span className="text-sm font-bold" style={{ color: '#10B981' }}>{s.pct}%</span>
                </div>
              )) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Work in progress — keep practising!</p>
              )}
            </div>
          </div>

          {/* Areas to improve */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#F59E0B' }}>target</span>
              </div>
              <div>
                <div className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>Areas to Improve</div>
                <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Focus here for quick gains</div>
              </div>
            </div>
            <div className="space-y-2">
              {improve.length > 0 ? improve.map(s => (
                <div key={s.subject} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                  <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{s.pct}%</span>
                </div>
              )) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All subjects above average — great balance!</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div ref={chatRef} className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
            >
              <span className="material-symbols-outlined filled text-white" style={{ fontSize: '13px' }}>smart_toy</span>
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Ask Your AI Tutor
            </span>
          </div>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>
      </div>

      {/* ── Chat section ────────────────────────────────────────────────────── */}
      <section
        className="max-w-5xl mx-auto px-4 pb-8"
        style={{ opacity: chatReady ? 1 : 0, transition: 'opacity 0.6s ease', minHeight: 400 }}
      >
        {/* Messages */}
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
                <button
                  key={q}
                  onClick={() => void sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all hover:-translate-y-px"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div
          className="sticky bottom-0 pt-3 pb-2"
          style={{ backgroundColor: 'var(--bg)' }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <span className="material-symbols-outlined filled shrink-0" style={{ fontSize: '18px', color: '#5B4FE8' }}>smart_toy</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about your performance, mistakes, what to study next…"
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
            AI responses are personalised based on your test performance.
          </p>
        </div>
      </section>

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg);    opacity: 1; }
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

/* ── Animated subject bar ───────────────────────────────────────────────────── */

function SubjectBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const [width, setWidth] = useState('0%');
  useEffect(() => {
    const t = setTimeout(() => setWidth(`${pct}%`), delay * 1000);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div
      className="h-full rounded-full"
      style={{ width, backgroundColor: color, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }}
    />
  );
}
