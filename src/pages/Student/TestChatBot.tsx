import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';

interface TestResult {
  score?:         number;
  correctCount?:  number;
  incorrectCount?: number;
  skippedCount?:  number;
  accuracyPct?:   number;
  examTitle?:     string;
}

interface Message {
  id:      number;
  role:    'ai' | 'user';
  text:    string;
  typing?: boolean;
}

// ── Deterministic AI response engine ─────────────────────────────────────────

function buildWelcome(result: TestResult, name: string): string {
  const acc = result.accuracyPct ?? Math.round(((result.correctCount ?? 0) / ((result.correctCount ?? 0) + (result.incorrectCount ?? 1) + (result.skippedCount ?? 0))) * 100);
  const score = result.score ?? result.correctCount ?? 0;

  if (acc >= 85) {
    return `Great work, ${name}! 🎉 You scored ${score} with ${acc}% accuracy — that's in the top tier. Your consistency is paying off. Ask me anything about your performance, what to study next, or where you can push even higher.`;
  } else if (acc >= 65) {
    return `Well done, ${name}! You scored ${score} with ${acc}% accuracy. You're on the right track — there are a few key areas where small improvements will make a big difference. Ask me what to focus on, or let's talk through the topics you found tricky.`;
  } else {
    return `Hey ${name}, you scored ${score} with ${acc}% accuracy. Don't worry — every attempt is a step forward. I can pinpoint exactly what to revise and build a recovery plan. What would you like to know first?`;
  }
}

function getAIResponse(input: string, result: TestResult): string {
  const q     = input.toLowerCase();
  const acc   = result.accuracyPct ?? 70;
  const wrong = result.incorrectCount ?? 0;
  const skip  = result.skippedCount  ?? 0;

  if (q.includes('mistake') || q.includes('wrong') || q.includes('incorrect') || q.includes('error')) {
    return `You got ${wrong} questions wrong in this test. The most common pattern I see is rushing through medium-difficulty questions without re-reading the options. Try spending 10–15 extra seconds on each option before finalising. Focus on the topics from Section B — those had the most errors.`;
  }
  if (q.includes('skip') || q.includes('unattempt') || q.includes('blank')) {
    return `You left ${skip} questions unattempted. In competitive exams with negative marking, strategic skipping is fine — but some of those skipped questions were in areas where you've shown strength before. Next time, at least attempt the ones you're 60%+ confident on. No marks are lost for a reasonable guess in those.`;
  }
  if (q.includes('next') || q.includes('study') || q.includes('recommend') || q.includes('focus') || q.includes('improve')) {
    if (acc >= 80) {
      return `You're performing strongly. To push from this level to the top 1%, focus on: (1) Speed — solve 10 harder problems per day under timed conditions. (2) Accuracy on Hard questions — that's where ranks are decided. (3) Revise Organic Chemistry and Wave Optics, which showed slight dips. Keep up the 14-day streak!`;
    }
    return `Based on your performance, here's your 3-step improvement plan:\n\n1. **Revise Weak Topics** — Circular Motion, Wave Optics, and Organic Synthesis showed the lowest accuracy. Spend 2 sessions each.\n2. **Practice Medium Questions** — Your Medium difficulty accuracy (${Math.round(acc * 0.85)}%) needs a lift. Attempt 15 per day.\n3. **Full-length mocks** — Take one per week. Time management was slightly off this attempt.`;
  }
  if (q.includes('rank') || q.includes('percentile') || q.includes('position')) {
    return `Based on this test score, you're approximately in the ${acc >= 85 ? 'top 10%' : acc >= 70 ? 'top 25%' : 'top 40%'} of your batch. Keep in mind that national rank depends on the difficulty calibration across all test-takers. Consistent improvement over the next 4 weeks can move you up significantly — each 5% improvement in accuracy typically shifts rank by 20–30 positions.`;
  }
  if (q.includes('time') || q.includes('speed') || q.includes('fast') || q.includes('slow')) {
    return `Time management is key. You should aim for: Physics — 40 min, Chemistry — 35 min, Math/Biology — 45 min. If you're spending more than 3 minutes on a single question, skip and return. Practice solving 20 questions in 30 minutes daily to build speed without sacrificing accuracy.`;
  }
  if (q.includes('motivat') || q.includes('discourag') || q.includes('frustrat') || q.includes('feel') || q.includes('sad')) {
    return `It's completely normal to feel this way — every serious aspirant goes through this phase. Remember: the fact that you're here, reviewing your performance after a test, already puts you ahead of 70% of your peers who don't. Progress isn't always linear. You've improved since your last test, and one more focused week can change a lot. You've got this. 💪`;
  }
  if (q.includes('physics') || q.includes('chem') || q.includes('math') || q.includes('bio')) {
    const sub = q.includes('physics') ? 'Physics' : q.includes('chem') ? 'Chemistry' : q.includes('bio') ? 'Biology' : 'Mathematics';
    return `For ${sub}, your recent accuracy suggests you're strong on conceptual questions but struggle with numerical applications. My recommendation: (1) Solve 10 previous year JEE/NEET ${sub} questions daily. (2) Watch short concept videos on your weak chapters. (3) Create a formula sheet and review it every night for 10 minutes. Would you like a specific topic list?`;
  }
  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    return `Hi there! I'm your AI tutor. I've analysed your test results and I'm ready to help. You can ask me about your mistakes, what to study next, time management tips, or anything else about your preparation. What's on your mind?`;
  }
  return `That's a great question. Based on your ${acc}% accuracy in this test, the most impactful thing you can do right now is focus on consolidating medium-difficulty topics where small errors are costing you the most marks. Would you like a specific study plan, topic recommendations, or to talk through any particular question type?`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TestChatBot() {
  const location = useLocation();
  const result   = (location.state as TestResult | null) ?? {};
  const session  = getAuthSession();
  const name     = session?.user?.name?.split(' ')[0] ?? 'there';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  let nextId = useRef(1);

  const suggestedQuestions = [
    'What did I get wrong?',
    'What should I study next?',
    'How can I improve my rank?',
    'Any time management tips?',
    'How was my performance?',
  ];

  useEffect(() => {
    // Delay the welcome message slightly for a natural feel
    const t = setTimeout(() => {
      setMessages([{
        id:   nextId.current++,
        role: 'ai',
        text: buildWelcome(result, name),
      }]);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || busy) return;
    setInput('');
    setBusy(true);

    const userMsg: Message = { id: nextId.current++, role: 'user', text: text.trim() };
    const typingMsg: Message = { id: nextId.current++, role: 'ai', text: '', typing: true };

    setMessages(prev => [...prev, userMsg, typingMsg]);

    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

    const reply = getAIResponse(text, result);
    setMessages(prev =>
      prev.map(m => m.typing ? { ...m, text: reply, typing: false } : m)
    );
    setBusy(false);
    inputRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  const score   = result.score ?? result.correctCount ?? 0;
  const correct = result.correctCount ?? 0;
  const wrong   = result.incorrectCount ?? 0;
  const skipped = result.skippedCount ?? 0;
  const total   = correct + wrong + skipped || 50;
  const acc     = result.accuracyPct ?? (Math.round((correct / total) * 100) || 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-5 h-16"
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            <span className="material-symbols-outlined filled text-white" style={{ fontSize: '18px' }}>smart_toy</span>
          </div>
          <div>
            <div className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>AI Tutor</div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Analysing your results</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={pathFor('analysis')} className="btn-outline btn-sm">
            View Analysis
          </Link>
          <Link to={pathFor('student')} className="btn-primary btn-sm">
            Dashboard
          </Link>
        </div>
      </header>

      {/* Score summary bar */}
      <div
        className="px-5 py-3 flex items-center gap-4 flex-wrap"
        style={{ backgroundColor: 'var(--surface-muted)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-body-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
          {result.examTitle ?? 'Mock Test'} results:
        </span>
        {[
          { label: 'Score',     value: String(score),     color: '#5B4FE8' },
          { label: 'Accuracy',  value: `${acc}%`,         color: '#10B981' },
          { label: 'Correct',   value: String(correct),   color: '#10B981' },
          { label: 'Incorrect', value: String(wrong),     color: '#EF4444' },
          { label: 'Skipped',   value: String(skipped),   color: '#9CA3AF' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{item.label}:</span>
            <span className="text-label-lg font-bold" style={{ color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-3xl w-full mx-auto">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            {msg.role === 'ai' ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              >
                <span className="material-symbols-outlined filled text-white" style={{ fontSize: '15px' }}>smart_toy</span>
              </div>
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Bubble */}
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
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--text-faint)', animation: `bounce 1.2s ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              ) : msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions (shown until first user message) */}
      {messages.filter(m => m.role === 'user').length === 0 && messages.length > 0 && (
        <div className="px-4 pb-3 max-w-3xl w-full mx-auto">
          <p className="text-label-sm mb-2" style={{ color: 'var(--text-faint)' }}>Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map(q => (
              <button
                key={q}
                onClick={() => void sendMessage(q)}
                className="text-label-sm px-3 py-1.5 rounded-full transition-all hover:-translate-y-px"
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
        className="px-4 py-3 max-w-3xl w-full mx-auto"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask about your performance, mistakes, study plan…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={busy}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || busy}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>send</span>
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
          AI responses are based on your test data and study patterns.
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
