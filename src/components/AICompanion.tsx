import { useEffect, useRef, useState } from 'react';
import { askAI, hasAI } from '../lib/ai';
import { getAuthSession } from '../lib/auth';
import { getStudentStream, STREAM_EXAM } from '../lib/stream';

interface Msg { id: number; role: 'ai' | 'user'; text: string; typing?: boolean }

const SUGGESTIONS = [
  'Explain Newton\'s third law simply',
  'Give me a 7-day revision plan',
  'How do I stop silly mistakes?',
];

export default function AICompanion() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState('');
  const [busy, setBusy]         = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = getAuthSession();
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';
  const stream = getStudentStream();
  const exam = stream ? STREAM_EXAM[stream] : 'JEE/NEET';

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: nextId.current++,
        role: 'ai',
        text: `Hi ${firstName}! I'm your Concept Crack AI companion. Ask me to explain a concept, plan your revision, or clear a doubt for ${exam}.`,
      }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: Msg = { id: nextId.current++, role: 'user', text: trimmed };
    const typing: Msg  = { id: nextId.current++, role: 'ai', text: '', typing: true };
    setMessages(prev => [...prev, userMsg, typing]);
    setInput('');
    setBusy(true);

    const prompt = `You are Concept Crack's friendly AI study companion for Indian competitive exams (${exam}).
The student's name is ${firstName}. Answer their question clearly and concisely (3-6 sentences, use simple steps or bullet points when helpful). Be encouraging and practical.

Student: ${trimmed}`;

    let reply: string;
    try {
      reply = hasAI()
        ? await askAI(prompt, { maxTokens: 800 })
        : 'The AI companion needs an API key to answer. Add VITE_GEMINI_API_KEY in your environment to enable it.';
    } catch {
      reply = 'Sorry — I could not reach the AI service just now. Please try again in a moment.';
    }

    setMessages(prev => prev.map(m => (m.typing ? { ...m, text: reply, typing: false } : m)));
    setBusy(false);
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', zIndex: 70 }}
        aria-label="AI Companion"
        title="AI Companion"
      >
        <span className="material-symbols-outlined filled text-white" style={{ fontSize: '26px' }}>
          {open ? 'close' : 'auto_awesome'}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 'min(380px, calc(100vw - 3rem))',
            height: 'min(540px, calc(100vh - 8rem))',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
            zIndex: 70,
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined filled text-white" style={{ fontSize: '18px' }}>auto_awesome</span>
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-sm">AI Companion</div>
              <div className="text-white/70 text-[11px]">Always here to help you learn</div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" style={{ backgroundColor: 'var(--bg)' }}>
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', color: '#fff' }
                    : { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                  }
                >
                  {m.typing ? <span className="inline-flex gap-1"><Dot /><Dot d={0.2} /><Dot d={0.4} /></span> : m.text}
                </div>
              </div>
            ))}

            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="text-[12px] px-2.5 py-1.5 rounded-full transition-colors"
                    style={{ backgroundColor: 'rgba(91,79,232,0.08)', color: '#5B4FE8', border: '1px solid rgba(91,79,232,0.20)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              placeholder="Ask anything about your studies…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={!input.trim() || busy}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              aria-label="Send"
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>send</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Dot({ d = 0 }: { d?: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full inline-block animate-bounce"
      style={{ backgroundColor: 'var(--text-muted)', animationDelay: `${d}s` }}
    />
  );
}
