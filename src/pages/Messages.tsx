import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Spinner from '../components/Spinner';
import { getAuthSession } from '../lib/auth';
import { pathFor, type PageKey } from '../lib/pages';
import { useToast } from '../components/Toast';
import {
  getOrCreateThread, listThreads, sendChatMessage, subscribeToMessages, listContactsFor,
  type ChatThread, type ChatMessage, type ChatContact, type ChatParticipant,
} from '../lib/messages';
import { uploadChatAttachment } from '../lib/storage';

const ROLE_COLOR: Record<string, string> = {
  student: '#6B5EF0',
  faculty: '#0D9488',
  parent:  '#EA580C',
  admin:   '#DB2777',
};

function initialsOf(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Messages() {
  const navigate = useNavigate();
  const toast    = useToast();
  const session = getAuthSession();
  const me: ChatParticipant = {
    uid:  session?.user?.id ?? '',
    name: session?.user?.name ?? 'User',
    role: session?.user?.role ?? 'student',
  };
  const dashboardPath = pathFor(me.role as PageKey);

  const [threads, setThreads]   = useState<ChatThread[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [active, setActive]     = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [sending, setSending]   = useState(false);

  // Staged attachment — picked but not sent yet.
  const [attachFile,    setAttachFile]    = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load my threads + who I'm allowed to message
  useEffect(() => {
    if (!me.uid) return;
    let cancelled = false;
    Promise.all([listThreads(me.uid), listContactsFor(me.role)])
      .then(([ts, cs]) => {
        if (cancelled) return;
        setThreads(ts);
        setContacts(cs.filter(c => c.uid !== me.uid));
        if (ts.length > 0) setActive(ts[0]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.uid]);

  // Real-time subscription to the active thread
  useEffect(() => {
    if (!active) { setMessages([]); return; }
    const unsub = subscribeToMessages(active.id, setMessages);
    return unsub;
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function openContact(c: ChatContact) {
    setShowNew(false);
    const existing = threads.find(t => t.participants.includes(c.uid));
    if (existing) { setActive(existing); return; }
    const thread = await getOrCreateThread(me, { uid: c.uid, name: c.name, role: c.role });
    setThreads(prev => [thread, ...prev.filter(t => t.id !== thread.id)]);
    setActive(thread);
  }

  function pickAttachment(file: File | null) {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { toast('Please choose an image or video file.', 'error'); return; }
    const limitMb = isImage ? 10 : 50;
    if (file.size > limitMb * 1024 * 1024) { toast(`${isImage ? 'Image' : 'Video'} is too large (max ${limitMb} MB).`, 'error'); return; }

    if (attachPreview) URL.revokeObjectURL(attachPreview);
    setAttachFile(file);
    setAttachPreview(URL.createObjectURL(file));
  }

  function clearAttachment() {
    if (attachPreview) URL.revokeObjectURL(attachPreview);
    setAttachFile(null);
    setAttachPreview(null);
  }

  async function send() {
    const text = input.trim();
    if ((!text && !attachFile) || !active || sending) return;
    setSending(true);
    setInput('');
    const fileToSend = attachFile;
    clearAttachment();
    try {
      const attachment = fileToSend ? await uploadChatAttachment(fileToSend, active.id) : undefined;
      await sendChatMessage(active, me, text, attachment);
    } catch (e) {
      console.error('send failed', e);
      toast(e instanceof Error ? e.message : 'Could not send — please try again.', 'error');
    } finally {
      setSending(false);
    }
  }

  function otherOf(t: ChatThread): ChatParticipant {
    const otherUid = t.participants.find(p => p !== me.uid) ?? '';
    return t.participantInfo[otherUid] ?? { uid: otherUid, name: 'User', role: 'student' };
  }

  const filteredContacts = contacts.filter(c => {
    const s = contactSearch.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s);
  });

  const time = (at: string | null) => at ? new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Messages' }]}
        actions={
          <button type="button" onClick={() => navigate(dashboardPath)} className="btn-outline btn-md flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Dashboard
          </button>
        }
      />

      <div className="flex-1 p-4 lg:p-6 overflow-hidden">
        <div
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[300px_1fr] rounded-2xl overflow-hidden"
          style={{ height: 'calc(100vh - 7.5rem)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* ── Thread list ── */}
          <aside className="hidden md:flex flex-col min-h-0" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-body-md font-bold" style={{ color: 'var(--text-primary)' }}>Conversations</span>
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="icon-btn icon-btn-sm"
                title="Start a new conversation"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showNew ? 'close' : 'edit_square'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showNew ? (
                <div className="p-3 space-y-2">
                  <div className="search-bar">
                    <span className="material-symbols-outlined text-[16px] shrink-0">search</span>
                    <input
                      type="search"
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      placeholder={`Search ${me.role === 'faculty' ? 'students & parents' : 'faculty'}…`}
                      className="flex-1 bg-transparent outline-none text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  {filteredContacts.length === 0 && (
                    <p className="text-body-sm text-center py-6" style={{ color: 'var(--text-faint)' }}>No contacts found.</p>
                  )}
                  {filteredContacts.map(c => (
                    <button
                      key={c.uid}
                      type="button"
                      onClick={() => void openContact(c)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors hover:bg-[var(--surface-muted)]"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: ROLE_COLOR[c.role] ?? 'var(--brand)' }}>
                        {initialsOf(c.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-body-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                        <div className="text-label-sm capitalize" style={{ color: 'var(--text-muted)' }}>{c.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={20} color="var(--brand)" />
                </div>
              ) : threads.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <span className="material-symbols-outlined block mx-auto mb-2" style={{ fontSize: '28px', color: 'var(--text-faint)' }}>forum</span>
                  <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>No conversations yet.</p>
                  <button type="button" onClick={() => setShowNew(true)} className="btn-outline btn-sm mt-3 mx-auto">
                    Start one
                  </button>
                </div>
              ) : (
                threads.map(t => {
                  const other = otherOf(t);
                  const isActive = active?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActive(t)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{ backgroundColor: isActive ? 'rgba(107,94,240,0.06)' : 'transparent', borderLeft: `3px solid ${isActive ? 'var(--brand)' : 'transparent'}` }}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: ROLE_COLOR[other.role] ?? 'var(--brand)' }}>
                        {initialsOf(other.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-body-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{other.name}</div>
                        <div className="text-label-sm truncate" style={{ color: 'var(--text-muted)' }}>
                          {t.lastFrom === me.uid ? 'You: ' : ''}{t.lastMessage || `${other.role} · new conversation`}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── Chat pane ── */}
          <section className="flex flex-col min-h-0">
            {active ? (
              <>
                {(() => {
                  const other = otherOf(active);
                  return (
                    <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: ROLE_COLOR[other.role] ?? 'var(--brand)' }}>
                        {initialsOf(other.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-body-md font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{other.name}</div>
                        <div className="text-label-sm capitalize" style={{ color: 'var(--text-muted)' }}>{other.role}</div>
                      </div>
                      <span className="badge badge-success hidden sm:inline-flex">
                        <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: '#10B981' }} />
                        Live
                      </span>
                    </div>
                  );
                })()}

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ backgroundColor: 'var(--bg)' }}>
                  {messages.length === 0 && (
                    <p className="text-center text-body-sm py-8" style={{ color: 'var(--text-faint)' }}>
                      This is the beginning of your conversation. Say hello!
                    </p>
                  )}
                  {messages.map(m => {
                    const mine = m.from === me.uid;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[75%] overflow-hidden text-sm leading-relaxed"
                          style={{
                            backgroundColor: mine ? 'var(--brand)' : 'var(--surface)',
                            color: mine ? '#fff' : 'var(--text-primary)',
                            border: mine ? 'none' : '1px solid var(--border)',
                            borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          }}
                        >
                          {m.attachmentUrl && (
                            m.attachmentType === 'video' ? (
                              <video src={m.attachmentUrl} controls className="block w-full max-h-72 bg-black" />
                            ) : (
                              <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                <img src={m.attachmentUrl} alt={m.attachmentName ?? 'Attachment'} className="block w-full max-h-72 object-cover" />
                              </a>
                            )
                          )}
                          <div className="px-4 py-2.5">
                            {m.text && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.text}</p>}
                            <div className="text-[10px] mt-1 text-right" style={{ color: mine ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)' }}>
                              {time(m.at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {attachFile && (
                  <div className="px-4 pt-3 shrink-0">
                    <div className="inline-flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                      {attachFile.type.startsWith('video/') ? (
                        <video src={attachPreview ?? undefined} className="w-12 h-12 rounded-lg object-cover bg-black" />
                      ) : (
                        <img src={attachPreview ?? undefined} alt="Selected attachment" className="w-12 h-12 rounded-lg object-cover" />
                      )}
                      <span className="text-body-sm max-w-[160px] truncate" style={{ color: 'var(--text-primary)' }}>{attachFile.name}</span>
                      <button
                        type="button"
                        onClick={clearAttachment}
                        className="icon-btn icon-btn-sm"
                        aria-label="Remove attachment"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={e => { pickAttachment(e.target.files?.[0] ?? null); e.target.value = ''; }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="icon-btn icon-btn-md shrink-0"
                    aria-label="Attach image or video"
                    title="Attach image or video"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>attach_file</span>
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder="Type a message…"
                    className="flex-1 h-11 px-4 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={(!input.trim() && !attachFile) || sending}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
                    aria-label="Send message"
                  >
                    {sending ? <Spinner size={16} color="#fff" /> : <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--text-faint)' }}>forum</span>
                <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {loading ? 'Loading conversations…' : 'Select a conversation or start a new one'}
                </p>
                {!loading && (
                  <button type="button" onClick={() => setShowNew(true)} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_square</span>
                    New conversation
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
