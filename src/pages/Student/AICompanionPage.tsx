import { useEffect, useRef, useState } from 'react';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getExamCountdown } from '../../lib/examCountdown';
import {
  listSessions, createSession, saveSessionMessages, deleteSession,
  type CompanionSession, type CompanionMessage,
} from '../../lib/companionChats';
import AIMarkdown from '../../components/AIMarkdown';
import TopBar from '../../components/TopBar';

interface Msg extends CompanionMessage { id: number; typing?: boolean }

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

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AICompanionPage() {
  const session = getAuthSession();
  const uid = session?.user?.id;
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';
  const stream = getStudentStream();
  const exam = stream ? getExamCountdown(stream).examLabel : 'JEE/NEET';

  const greeting = `Hi ${firstName}! I'm your Concept Crack AI companion. Ask me to explain a concept, plan your revision, or clear a doubt for ${exam}.`;

  const [sessions, setSessions]       = useState<CompanionSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [messages, setMessages]       = useState<Msg[]>([]);
  const [input, setInput]             = useState('');
  const [busy, setBusy]               = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real, persisted chat history — stored per-student in Firestore
  // (companionSessions), same idea as ChatGPT's chat list: past conversations
  // survive a refresh/navigation and can be reopened later.
  useEffect(() => {
    if (!uid) { setSessionsLoading(false); return; }
    let cancelled = false;
    listSessions(uid).then(list => {
      if (cancelled) return;
      setSessions(list);
      setSessionsLoading(false);
    }).catch(() => { if (!cancelled) setSessionsLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function openSession(s: CompanionSession) {
    setActiveId(s.id);
    setMessages(s.messages.map(m => ({ ...m, id: nextId.current++ })));
    setInput('');
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([{ id: nextId.current++, role: 'ai', text: greeting }]);
    setInput('');
  }

  // First visit (no sessions yet, nothing selected) — show the greeting in a
  // fresh, unsaved conversation rather than an empty screen.
  useEffect(() => {
    if (!sessionsLoading && sessions.length === 0 && activeId === null && messages.length === 0) {
      startNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsLoading, sessions.length]);

  async function persist(nextMessages: Msg[]) {
    if (!uid) return;
    const toSave: CompanionMessage[] = nextMessages.filter(m => !m.typing).map(({ role, text }) => ({ role, text }));
    try {
      if (activeId) {
        await saveSessionMessages(activeId, toSave);
      } else {
        const created = await createSession(uid);
        await saveSessionMessages(created.id, toSave);
        setActiveId(created.id);
      }
      // Re-fetch from the source of truth so title/order stay accurate.
      setSessions(await listSessions(uid));
    } catch (e) {
      console.error('Failed to save companion chat:', e);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: Msg = { id: nextId.current++, role: 'user', text: trimmed };
    const typing: Msg  = { id: nextId.current++, role: 'ai', text: '', typing: true };
    const withUser = [...messages, userMsg, typing];
    setMessages(withUser);
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

    const finalMessages = withUser.map(m => (m.typing ? { ...m, text: reply, typing: false } : m));
    setMessages(finalMessages);
    setBusy(false);
    void persist(finalMessages);
  }

  async function removeSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeId === id) startNewChat();
    } catch (err) {
      console.error('Failed to delete companion chat:', err);
    }
  }

  const isNewEmptyChat = messages.length <= 1;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Chat history sidebar — ChatGPT-style: new chat button + stored past
          conversations, most recent first, click to reopen. */}
      <div className="hidden md:flex flex-col w-[260px] shrink-0" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div className="p-3">
          <button
            type="button"
            onClick={startNewChat}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--surface-hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {sessionsLoading && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-faint)' }}>Loading chats…</div>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-faint)' }}>Your saved chats will show up here.</div>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSession(s)}
              className="group w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors"
              style={{ backgroundColor: activeId === s.id ? 'var(--surface-hover)' : 'transparent' }}
            >
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--text-faint)' }}>chat_bubble</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{s.title}</span>
                <span className="block text-[11px]" style={{ color: 'var(--text-faint)' }}>{relativeTime(s.updatedAt)}</span>
              </span>
              <span
                role="button"
                onClick={e => void removeSession(s.id, e)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 hover:bg-[var(--surface-muted)]"
                title="Delete chat"
                aria-label="Delete chat"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--text-faint)' }}>delete</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main conversation panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar breadcrumb={[{ label: 'AI Companion' }]} />

        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}>
            <span className="material-symbols-outlined filled text-white" style={{ fontSize: '18px' }}>auto_awesome</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>AI Companion</div>
            <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: '#4ADE80' }} />
              Online · tailored to your {exam} prep
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="max-w-3xl mx-auto space-y-4">
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

            {/* Suggested-prompt tiles on a fresh/empty conversation — same role
                as ChatGPT's example-prompt cards on a new chat. */}
            {isNewEmptyChat && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={busy}
                    className="text-left text-sm font-medium px-4 py-3 rounded-xl transition-all hover:-translate-y-px disabled:opacity-40"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <span className="material-symbols-outlined align-middle mr-1.5" style={{ fontSize: 15, color: 'var(--brand)' }}>bolt</span>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="max-w-3xl mx-auto">
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
