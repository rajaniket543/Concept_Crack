import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { useToast } from '../../components/Toast';
import { listBankQuestions, QUESTION_ORIGINS, type BankQuestion } from '../../lib/questionBank';
import { createTest, type LockMode } from '../../lib/tests';
import { pathFor } from '../../lib/pages';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DIFF_COLOR: Record<string, string> = { Easy: '#10B981', Medium: '#F59E0B', Hard: '#EF4444' };

interface Picked { q: BankQuestion; marks: number; time: number; }

export default function ManualTestBuilder() {
  const navigate = useNavigate();
  const toast    = useToast();
  const session  = getAuthSession();
  const uid      = session?.user?.id ?? '';
  const stream   = getStudentStream() ?? 'JEE';

  const [all, setAll]         = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch]         = useState('');
  const [subject, setSubject]       = useState('All');
  const [chapter, setChapter]       = useState('');
  const [topic, setTopic]           = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [origin, setOrigin]         = useState('All');
  const [code, setCode]             = useState('');
  const [uploader, setUploader]     = useState('All');

  const [picked, setPicked]   = useState<Picked[]>([]);
  const [preview, setPreview] = useState<BankQuestion | null>(null);

  // Finalize
  const [title, setTitle]     = useState('');
  const [type, setType]       = useState<'faculty_batch' | 'faculty_coaching'>('faculty_batch');
  const [lockMode, setLockMode] = useState<LockMode>('locked');
  const [negativeMarking, setNeg] = useState(true);
  const [saving, setSaving]   = useState(false);

  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    listBankQuestions().then(setAll).catch(() => setAll([])).finally(() => setLoading(false));
  }, []);

  const uploaders = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach(q => { if (q.uploadedBy) map.set(q.uploadedBy, q.uploadedByName || q.uploadedBy); });
    return [...map.entries()];
  }, [all]);

  const pickedIds = useMemo(() => new Set(picked.map(p => p.q.id)), [picked]);

  const results = useMemo(() => {
    const s = search.toLowerCase();
    return all.filter(q => {
      if (subject !== 'All' && q.subject !== subject) return false;
      if (difficulty !== 'All' && q.difficulty !== difficulty) return false;
      if (origin !== 'All' && (q.origin ?? '') !== origin) return false;
      if (uploader !== 'All' && q.uploadedBy !== uploader) return false;
      if (chapter && !q.chapter.toLowerCase().includes(chapter.toLowerCase())) return false;
      if (topic && !(q.topic ?? '').toLowerCase().includes(topic.toLowerCase())) return false;
      if (code && !(q.code ?? '').toLowerCase().includes(code.toLowerCase())) return false;
      if (s && !(`${q.code ?? ''} ${q.question} ${q.chapter} ${q.topic ?? ''}`.toLowerCase().includes(s))) return false;
      return true;
    }).slice(0, 200);
  }, [all, search, subject, chapter, topic, difficulty, origin, code, uploader]);

  function add(q: BankQuestion) {
    if (pickedIds.has(q.id)) return;
    setPicked(prev => [...prev, { q, marks: 4, time: 90 }]);
  }
  function remove(id: string) { setPicked(prev => prev.filter(p => p.q.id !== id)); }
  function setMarks(id: string, marks: number) { setPicked(prev => prev.map(p => p.q.id === id ? { ...p, marks } : p)); }
  function setTime(id: string, time: number)   { setPicked(prev => prev.map(p => p.q.id === id ? { ...p, time } : p)); }

  function onDrop(index: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === index) return;
    setPicked(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }

  const totalMarks = picked.reduce((s, p) => s + p.marks, 0);
  const totalSeconds = picked.reduce((s, p) => s + p.time, 0);

  function resetFilters() { setSearch(''); setSubject('All'); setChapter(''); setTopic(''); setDifficulty('All'); setOrigin('All'); setCode(''); setUploader('All'); }

  async function finalize() {
    if (!title.trim()) { toast('Enter a test title', 'error'); return; }
    if (picked.length === 0) { toast('Add at least one question', 'error'); return; }
    setSaving(true);
    try {
      const subjects = [...new Set(picked.map(p => p.q.subject).filter(Boolean))];
      const chapters = [...new Set(picked.map(p => p.q.chapter).filter(Boolean))];
      await createTest({
        type,
        status:          type === 'faculty_coaching' ? 'pending_approval' : 'active',
        title:           title.trim(),
        createdBy:       uid,
        subjects:        subjects.length ? subjects : ['Physics'],
        chapters,
        difficulty:      'Mixed',
        questionCount:   picked.length,
        durationSeconds: totalSeconds,
        startAt:         new Date().toISOString(),
        endAt:           null,
        instructions:    'Manually constructed test.',
        negativeMarking,
        lockMode,
        autoSubmitViolations: lockMode === 'locked' ? 2 : 0,
        questionMarks:   Object.fromEntries(picked.map(p => [p.q.id, p.marks])),
        questionTimes:   Object.fromEntries(picked.map(p => [p.q.id, p.time])),
        assignedTo:      'all',
        questionIds:     picked.map(p => p.q.id),
        stream,
      });
      toast(type === 'faculty_coaching' ? 'Test submitted for approval' : 'Test created & activated', 'success');
      navigate(pathFor('manageTests'));
    } catch (e) {
      console.error(e);
      toast('Failed to create test', 'error');
    } finally { setSaving(false); }
  }

  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Build a Test</h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>Search the question bank, add questions, reorder them, and set marks &amp; time per question.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Left: question search ── */}
        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-primary)' }}>Question Bank</h2>
            <button type="button" onClick={resetFilters} className="btn-ghost btn-sm">Reset</button>
          </div>
          <div className="search-bar">
            <span className="material-symbols-outlined text-[18px] shrink-0">search</span>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Code, prompt, chapter, topic…" className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select value={subject} onChange={e => setSubject(e.target.value)} className="input-field w-full" style={inputStyle}>{['All', ...SUBJECTS].map(s => <option key={s}>{s}</option>)}</select>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="input-field w-full" style={inputStyle}>{['All', 'Easy', 'Medium', 'Hard'].map(d => <option key={d}>{d}</option>)}</select>
            <select value={origin} onChange={e => setOrigin(e.target.value)} className="input-field w-full" style={inputStyle}>{['All', ...QUESTION_ORIGINS].map(o => <option key={o}>{o}</option>)}</select>
            <input type="text" value={chapter} onChange={e => setChapter(e.target.value)} placeholder="Chapter" className="input-field w-full" style={inputStyle} />
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic" className="input-field w-full" style={inputStyle} />
            <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="Code" className="input-field w-full" style={inputStyle} />
            <select value={uploader} onChange={e => setUploader(e.target.value)} className="input-field w-full col-span-2 sm:col-span-3" style={inputStyle}>
              <option value="All">Any uploader</option>
              {uploaders.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>

          <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />)
            ) : results.length === 0 ? (
              <p className="text-center text-body-sm py-8" style={{ color: 'var(--text-faint)' }}>
                {all.length === 0 ? 'No questions in the bank yet.' : 'No questions match your filters.'}
              </p>
            ) : results.map(q => {
              const added = pickedIds.has(q.id);
              return (
                <div key={q.id} className="rounded-lg p-3 flex items-start gap-3" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono" style={{ color: '#5B4FE8' }}>{q.code ?? '—'}</span>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DIFF_COLOR[q.difficulty] ?? '#9CA3AF' }} title={q.difficulty} />
                      <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{q.subject} · {q.chapter}{q.topic ? ` · ${q.topic}` : ''}</span>
                    </div>
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{q.question || '(no text)'}</p>
                  </div>
                  <button type="button" onClick={() => setPreview(q)} className="icon-btn icon-btn-sm shrink-0" title="Preview"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span></button>
                  <button type="button" onClick={() => add(q)} disabled={added} className="btn-sm shrink-0"
                    style={{ backgroundColor: added ? 'var(--surface)' : '#5B4FE8', color: added ? 'var(--text-faint)' : '#fff', border: added ? '1px solid var(--border)' : 'none', borderRadius: 8, padding: '4px 10px' }}>
                    {added ? 'Added' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: test being built ── */}
        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-primary)' }}>Your Test · {picked.length} question{picked.length === 1 ? '' : 's'}</h2>
            <span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{totalMarks} marks · {Math.round(totalSeconds / 60)} min</span>
          </div>

          <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
            {picked.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ border: '2px dashed var(--border)' }}>
                <span className="material-symbols-outlined block mb-2" style={{ fontSize: 32, color: 'var(--text-faint)' }}>playlist_add</span>
                <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>Add questions from the bank to start building.</p>
              </div>
            ) : picked.map((p, i) => (
              <div
                key={p.q.id}
                draggable
                onDragStart={() => { dragIndex.current = i; }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="rounded-lg p-3 flex items-center gap-2"
                style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', cursor: 'grab' }}
              >
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18, color: 'var(--text-faint)' }}>drag_indicator</span>
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.q.question || '(no text)'}</p>
                  <span className="text-[11px] font-mono" style={{ color: '#5B4FE8' }}>{p.q.code ?? '—'}</span>
                </div>
                <label className="flex items-center gap-1 shrink-0" title="Marks">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-faint)' }}>star</span>
                  <input type="number" value={p.marks} onChange={e => setMarks(p.q.id, Number(e.target.value))} className="w-12 rounded px-1 py-0.5 text-xs text-center" style={inputStyle} />
                </label>
                <label className="flex items-center gap-1 shrink-0" title="Seconds">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-faint)' }}>timer</span>
                  <input type="number" value={p.time} onChange={e => setTime(p.q.id, Number(e.target.value))} className="w-14 rounded px-1 py-0.5 text-xs text-center" style={inputStyle} />
                </label>
                <button type="button" onClick={() => remove(p.q.id)} className="icon-btn icon-btn-sm shrink-0"><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#EF4444' }}>close</span></button>
              </div>
            ))}
          </div>

          {/* Finalize */}
          <div className="pt-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Test title" className="input-field w-full" style={inputStyle} />
            <div className="grid grid-cols-2 gap-2">
              <select value={type} onChange={e => setType(e.target.value as typeof type)} className="input-field w-full" style={inputStyle}>
                <option value="faculty_batch">Batch (activate now)</option>
                <option value="faculty_coaching">Coaching (needs approval)</option>
              </select>
              <select value={lockMode} onChange={e => setLockMode(e.target.value as LockMode)} className="input-field w-full" style={inputStyle}>
                <option value="locked">Complete Lock Mode</option>
                <option value="open">Allow Tab Switching</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={negativeMarking} onChange={e => setNeg(e.target.checked)} />
              Negative marking (−1 per wrong answer)
            </label>
            <button type="button" onClick={finalize} disabled={saving || picked.length === 0} className="btn-primary btn-md w-full justify-center" style={{ background: saving ? undefined : 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span> Finalize Test</>}
            </button>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPreview(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-label-sm font-mono" style={{ color: '#5B4FE8' }}>{preview.code ?? 'no code'}</span>
              <button type="button" onClick={() => setPreview(null)} className="icon-btn icon-btn-sm"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              <p className="text-body-md" style={{ color: 'var(--text-primary)' }}>{preview.question}</p>
              {(['A', 'B', 'C', 'D'] as const).map(k => (
                <div key={k} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: preview.answer === k ? 'rgba(16,185,129,0.10)' : 'var(--surface-muted)', border: `1px solid ${preview.answer === k ? 'rgba(16,185,129,0.35)' : 'var(--border)'}` }}>
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: preview.answer === k ? '#10B981' : 'var(--surface)', color: preview.answer === k ? '#fff' : 'var(--text-muted)' }}>{k}</span>
                  <span className="text-body-md" style={{ color: 'var(--text-primary)' }}>{preview.options[k] || '—'}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => { add(preview); setPreview(null); }} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>Add to Test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
