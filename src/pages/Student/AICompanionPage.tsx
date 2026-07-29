import { useEffect, useRef, useState } from 'react';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getExamCountdown } from '../../lib/examCountdown';
import AIMarkdown from '../../components/AIMarkdown';
import TopBar from '../../components/TopBar';

interface Msg { id: number; role: 'ai' | 'user'; text: string; typing?: boolean }

const SUGGESTIONS = [
  'Explain Newton\'s third law simply',
  'Give me a 7-day revision plan',
  'How do I stop silly mistakes?',
  'Quiz me on my weakest concepts',
];

// Same real Gemini call as the floating widget (src/components/AICompanion.tsx) —
// this page is a deeper surface alongside it, not a replacement, so it
// intentionally mirrors the same model/prompt approach rather than inventing a
// second AI integration pattern.
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error('No API key');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 800, temperature: 0.6 },
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

export default function AICompanionPage() {
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
    setMessages([{
      id: nextId.current++,
      role: 'ai',
      text: `Hi ${firstName}! I'm your Concept Crack AI companion. Ask me to explain a concept, plan your revision, or clear a doubt for ${exam}.`,
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function newChat() {
    setMessages([{
      id: nextId.current++,
      role: 'ai',
      text: `Hi ${firstName}! I'm your Concept Crack AI companion. Ask me to explain a concept, plan your revision, or clear a doubt for ${exam}.`,
    }]);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'AI Companion' }]} />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 max-w-6xl mx-auto">
          {/* Chat panel */}
          <div
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{ height: '640px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-4 flex items-center gap-3 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}>
              <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} aria-hidden="true" />
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 relative">
                <span className="material-symbols-outlined filled text-white" style={{ fontSize: '22px' }}>auto_awesome</span>
              </div>
              <div className="flex-1 min-w-0 relative">
                <div className="text-white font-bold">AI Companion</div>
                <div className="text-white/80 text-[12px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: '#4ADE80' }} />
                  Online · trained on your recent tests
                </div>
              </div>
              <button
                type="button"
                onClick={newChat}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/15 relative"
                title="New conversation"
                aria-label="New conversation"
              >
                <span className="material-symbols-outlined text-white" style={{ fontSize: '19px' }}>ink_eraser</span>
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4" style={{ backgroundColor: 'var(--bg)' }}>
              {messages.map(m => (
                <div key={m.id} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5" style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}>
                      <span className="material-symbols-outlined filled text-white" style={{ fontSize: '16px' }}>auto_awesome</span>
                    </div>
                  )}
                  <div
                    className="max-w-[78%] px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed"
                    style={m.role === 'user'
                      ? { background: 'linear-gradient(135deg, var(--brand), #7C3AED)', color: '#fff', borderRadius: '16px 16px 4px 16px' }
                      : { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px' }
                    }
                  >
                    {m.typing ? (
                      <span className="inline-flex gap-1 py-1"><Dot /><Dot d={0.2} /><Dot d={0.4} /></span>
                    ) : m.role === 'ai' ? (
                      <AIMarkdown text={m.text} />
                    ) : m.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 flex gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={busy}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:-translate-y-px disabled:opacity-40"
                  style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="p-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
              <div className="flex items-center gap-2 rounded-full px-4 py-1.5" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                  placeholder="Ask anything — a doubt, a plan, or how you're really doing…"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => void send(input)}
                  disabled={!input.trim() || busy}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
                  aria-label="Send"
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>send</span>
                </button>
              </div>
              <div className="text-[11px] text-center mt-1.5" style={{ color: 'var(--text-faint)' }}>AI can make mistakes — verify important facts.</div>
            </div>
          </div>

          {/* Context sidebar */}
          <div className="flex flex-col gap-4">
            <div className="card">
              <div className="text-label-md font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Your Exam</div>
              <div className="text-title-md font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{exam}</div>
              <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                Ask about anything from today's syllabus, a doubt from your last test, or a revision plan — the companion tailors answers to {stream ?? 'your'} prep.
              </p>
            </div>
            <div className="card">
              <div className="text-label-md font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Quick Actions</div>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.slice(0, 3).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={busy}
                    className="text-left text-sm font-medium px-3 py-2.5 rounded-xl transition-all hover:-translate-y-px disabled:opacity-40 flex items-center gap-2"
                    style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--brand)' }}>bolt</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
