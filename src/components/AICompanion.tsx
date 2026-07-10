import { useEffect, useRef, useState } from 'react';
import { getAuthSession } from '../lib/auth';
import { getStudentStream } from '../lib/stream';
import { getExamCountdown } from '../lib/examCountdown';

interface Msg { id: number; role: 'ai' | 'user'; text: string; typing?: boolean }

const SUGGESTIONS = [
  'Explain Newton\'s third law simply',
  'Give me a 7-day revision plan',
  'How do I stop silly mistakes?',
];

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
// gemini-2.5-flash / gemini-2.0-flash are no longer available on free-tier
// keys for new Google Cloud projects — gemini-flash-lite-latest is a rolling
// alias Google keeps pointed at a currently-supported model.
const MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error('No API key');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0.6,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok && [404, 429, 500, 503].includes(res.status)) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response');
  return text.trim();
}

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
  const exam = stream ? getExamCountdown(stream).examLabel : 'JEE/NEET';

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
      reply = await callGemini(prompt);
    } catch (error) {
      console.error('AI Companion Gemini error:', error);
      reply = 'The AI companion could not reach Gemini right now. Please try again in a moment.';
    }

    setMessages(prev => prev.map(m => (m.typing ? { ...m, text: reply, typing: false } : m)));
    setBusy(false);
  }

  function resetChat() {
    setMessages([{
      id: nextId.current++,
      role: 'ai',
      text: `Hi ${firstName}! I'm your Concept Crack AI companion. Ask me to explain a concept, plan your revision, or clear a doubt for ${exam}.`,
    }]);
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 flex items-center justify-center rounded-full shadow-lg transition-all hover:scale-105"
        style={{
          width: 58, height: 58,
          background: open ? 'var(--surface)' : 'linear-gradient(135deg, #5B4FE8, #7C3AED)',
          border: open ? '1px solid var(--border)' : 'none',
          zIndex: 70,
          boxShadow: '0 8px 28px rgba(91,79,232,0.40)',
        }}
        aria-label="AI Companion"
        title="AI Companion"
      >
        {open ? (
          <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--text-muted)' }}>close</span>
        ) : (
          <>
            <span className="material-symbols-outlined filled text-white" style={{ fontSize: '26px' }}>auto_awesome</span>
            <span className="absolute top-1 right-1 w-3 h-3 rounded-full border-2" style={{ backgroundColor: '#10B981', borderColor: '#fff' }} />
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 flex flex-col rounded-3xl overflow-hidden"
          style={{
            width: 'min(400px, calc(100vw - 3rem))',
            height: 'min(580px, calc(100vh - 8rem))',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
            zIndex: 70,
          }}
        >
          {/* Header */}
          <div className="px-4 py-3.5 flex items-center gap-3 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
            <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} aria-hidden="true" />
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 relative">
              <span className="material-symbols-outlined filled text-white" style={{ fontSize: '20px' }}>auto_awesome</span>
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="text-white font-bold text-sm">AI Companion</div>
              <div className="text-white/80 text-[11px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: '#4ADE80' }} />
                Online · here to help you learn
              </div>
            </div>
            <button
              type="button"
              onClick={resetChat}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/15 relative"
              title="New chat"
              aria-label="New chat"
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>ink_eraser</span>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: 'var(--bg)' }}>
            {messages.map(m => (
              <div key={m.id} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'ai' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                    <span className="material-symbols-outlined filled text-white" style={{ fontSize: '15px' }}>auto_awesome</span>
                  </div>
                )}
                <div
                  className="max-w-[80%] px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', color: '#fff', borderRadius: '16px 16px 4px 16px' }
                    : { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px' }
                  }
                >
                  {m.typing ? <span className="inline-flex gap-1 py-1"><Dot /><Dot d={0.2} /><Dot d={0.4} /></span> : m.text}
                </div>
              </div>
            ))}

            {messages.length <= 1 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>Try asking</div>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="text-left text-[13px] px-3 py-2 rounded-xl transition-all hover:-translate-y-px flex items-center gap-2"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#5B4FE8' }}>bolt</span>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center gap-2 rounded-full px-4 py-1.5" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
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
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                aria-label="Send"
              >
                <span className="material-symbols-outlined text-white" style={{ fontSize: '17px' }}>send</span>
              </button>
            </div>
            <div className="text-[10px] text-center mt-1.5" style={{ color: 'var(--text-faint)' }}>AI can make mistakes — verify important facts.</div>
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
