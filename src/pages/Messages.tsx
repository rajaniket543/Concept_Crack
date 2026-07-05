import { useEffect, useRef, useState } from 'react';
import TopBar from '../components/TopBar';
import { getAuthSession } from '../lib/auth';

// Demo chat between a parent and their child's faculty. Both sides share one
// thread in localStorage so the conversation syncs within a browser.
// In production this thread moves to Firestore for real cross-user, real-time chat.

type Role = 'parent' | 'faculty';
interface ChatMsg { id: number; from: Role; text: string; at: number }

const THREAD_KEY = 'cc_chat_arjun_iyer';

const SEED: ChatMsg[] = [
  { id: 1, from: 'parent',  text: 'Good evening Sir, how is Arjun doing in Physics this month?', at: Date.now() - 86400000 },
  { id: 2, from: 'faculty', text: 'Hello! Arjun has improved in Mechanics but needs work on Rotational Motion. I have shared extra practice with him.', at: Date.now() - 82800000 },
];

function load(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    if (raw) return JSON.parse(raw) as ChatMsg[];
  } catch { /* ignore */ }
  localStorage.setItem(THREAD_KEY, JSON.stringify(SEED));
  return SEED;
}

export default function Messages() {
  const session = getAuthSession();
  const me: Role = session?.user?.role === 'faculty' ? 'faculty' : 'parent';
  const other: Role = me === 'faculty' ? 'parent' : 'faculty';

  const contactName = me === 'faculty' ? 'Mr. Sharma' : 'Dr. R. Iyer';
  const contactSub  = me === 'faculty' ? "Arjun Sharma's parent" : 'Physics Faculty · Resonance Academy';

  const [messages, setMessages] = useState<ChatMsg[]>(() => load());
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(Math.max(0, ...load().map(m => m.id)) + 1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const msg: ChatMsg = { id: nextId.current++, from: me, text, at: Date.now() };
    const next = [...messages, msg];
    setMessages(next);
    localStorage.setItem(THREAD_KEY, JSON.stringify(next));
    setInput('');
  }

  const time = (at: number) => new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Messages' }]} showSearch={false} />

      <div className="flex-1 p-6 lg:p-8 overflow-hidden">
        <div className="max-w-3xl mx-auto flex flex-col rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 8rem)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Contact header */}
          <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
              {contactName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1">
              <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{contactName}</div>
              <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{contactSub}</div>
            </div>
            <span className="flex items-center gap-1.5 text-label-sm" style={{ color: '#10B981' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }} /> Online
            </span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3" style={{ backgroundColor: 'var(--bg)' }}>
            {messages.map(m => {
              const mine = m.from === me;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%]">
                    <div
                      className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap"
                      style={mine
                        ? { background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', color: '#fff', borderBottomRightRadius: 4 }
                        : { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }
                      }
                    >
                      {m.text}
                    </div>
                    <div className={`text-[10px] mt-1 ${mine ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-faint)' }}>
                      {mine ? 'You' : (m.from === 'faculty' ? 'Dr. R. Iyer' : 'Mr. Sharma')} · {time(m.at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-4 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message ${contactName}…`}
              className="flex-1 input-field"
              style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim()}
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              aria-label="Send"
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>send</span>
            </button>
          </div>
        </div>
        <p className="text-center text-label-sm mt-3" style={{ color: 'var(--text-faint)' }}>
          You are chatting as <strong style={{ color: 'var(--text-muted)' }}>{me}</strong>. Messages are shared with {other === 'faculty' ? 'the faculty' : 'the parent'} in this demo.
        </p>
      </div>
    </div>
  );
}
