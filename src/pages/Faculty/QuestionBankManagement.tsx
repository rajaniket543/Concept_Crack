import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import {
  listBankQuestions,
  createBankQuestion,
  updateBankQuestion,
  deleteBankQuestion,
  backfillQuestionCodes,
  QUESTION_ORIGINS,
  type BankQuestion,
  type QuestionOrigin,
} from '../../lib/questionBank';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

const DIFFICULTY_COLOR: Record<string, { bg: string; color: string }> = {
  Easy:   { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  Medium: { bg: 'rgba(245,158,11,0.10)', color: '#D97706' },
  Hard:   { bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
};

const VERIFY_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  verified:   { bg: 'rgba(16,185,129,0.10)', color: '#059669', label: 'Verified' },
  pending:    { bg: 'rgba(245,158,11,0.10)', color: '#D97706', label: 'Pending' },
  unverified: { bg: 'rgba(148,163,184,0.14)', color: '#64748B', label: 'Unverified' },
};

type Draft = {
  question: string;
  A: string; B: string; C: string; D: string;
  answer: 'A' | 'B' | 'C' | 'D';
  subject: string;
  chapter: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  origin: QuestionOrigin;
  explanation: string;
};

const EMPTY_DRAFT: Draft = {
  question: '', A: '', B: '', C: '', D: '', answer: 'A',
  subject: 'Physics', chapter: '', topic: '', difficulty: 'Easy',
  origin: 'Faculty Upload', explanation: '',
};

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QuestionBankManagement() {
  const toast   = useToast();
  const session = getAuthSession();
  const uid     = session?.user?.id ?? '';
  const uname   = session?.user?.name ?? 'Faculty';
  const role    = session?.user?.role ?? 'faculty';

  const [all, setAll]         = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  const [search, setSearch]         = useState('');
  const [subject, setSubject]       = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [origin, setOrigin]         = useState('All');

  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft]             = useState<Draft>(EMPTY_DRAFT);

  const [previewQ, setPreviewQ] = useState<BankQuestion | null>(null);
  const [editQ, setEditQ]       = useState<BankQuestion | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  async function reload() {
    setLoading(true);
    try {
      setAll(await listBankQuestions());
    } catch (e) {
      console.error('load question bank failed', e);
      toast('Could not load the question bank', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, []);

  const rows = useMemo(() => all.filter(q => {
    const matchesSubject    = subject    === 'All' || q.subject    === subject;
    const matchesDifficulty = difficulty === 'All' || q.difficulty === difficulty;
    const matchesOrigin     = origin     === 'All' || (q.origin ?? '') === origin;
    const s = search.toLowerCase();
    const matchesSearch = !s ||
      (q.code ?? '').toLowerCase().includes(s) ||
      q.question.toLowerCase().includes(s) ||
      q.chapter.toLowerCase().includes(s) ||
      (q.topic ?? '').toLowerCase().includes(s) ||
      (q.uploadedByName ?? '').toLowerCase().includes(s);
    return matchesSubject && matchesDifficulty && matchesOrigin && matchesSearch;
  }), [all, subject, difficulty, origin, search]);

  const stats = useMemo(() => {
    const total = all.length;
    const coded = all.filter(q => q.code).length;
    const verified = all.filter(q => q.verificationStatus === 'verified').length;
    const byDiff = { Easy: 0, Medium: 0, Hard: 0 } as Record<string, number>;
    all.forEach(q => { byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1; });
    return { total, coded, verified, byDiff };
  }, [all]);

  function resetFilters() { setSearch(''); setSubject('All'); setDifficulty('All'); setOrigin('All'); }

  function draftToInput(d: Draft) {
    return {
      question: d.question.trim(),
      options: { A: d.A.trim(), B: d.B.trim(), C: d.C.trim(), D: d.D.trim() },
      answer: d.answer,
      subject: d.subject,
      chapter: d.chapter.trim(),
      topic: d.topic.trim(),
      difficulty: d.difficulty,
      origin: d.origin,
      explanation: d.explanation.trim(),
    };
  }

  function validate(d: Draft): string | null {
    if (!d.question.trim()) return 'Question text is required';
    if (!d.A.trim() || !d.B.trim() || !d.C.trim() || !d.D.trim()) return 'All four options are required';
    if (!d.chapter.trim()) return 'Chapter is required';
    return null;
  }

  async function addQuestion() {
    const err = validate(draft);
    if (err) { toast(err, 'error'); return; }
    setBusy(true);
    try {
      const { code } = await createBankQuestion({ ...draftToInput(draft), uploadedBy: uid, uploadedByName: uname });
      toast(`Question added · ${code}`, 'success');
      setDraft(EMPTY_DRAFT);
      setShowAddForm(false);
      await reload();
    } catch (e) {
      console.error(e);
      toast('Failed to add question', 'error');
    } finally { setBusy(false); }
  }

  function openEdit(q: BankQuestion) {
    setEditQ(q);
    setEditDraft({
      question: q.question, A: q.options.A, B: q.options.B, C: q.options.C, D: q.options.D,
      answer: (q.answer ?? 'A') as Draft['answer'],
      subject: q.subject || 'Physics', chapter: q.chapter, topic: q.topic ?? '',
      difficulty: q.difficulty, origin: (q.origin as QuestionOrigin) ?? 'Custom',
      explanation: q.explanation ?? '',
    });
  }

  async function saveEdit() {
    if (!editQ) return;
    const err = validate(editDraft);
    if (err) { toast(err, 'error'); return; }
    setBusy(true);
    try {
      await updateBankQuestion(editQ.id, draftToInput(editDraft));
      toast('Question updated', 'success');
      setEditQ(null);
      await reload();
    } catch (e) {
      console.error(e);
      toast('Failed to update question', 'error');
    } finally { setBusy(false); }
  }

  async function removeQuestion(q: BankQuestion) {
    if (!window.confirm(`Delete question ${q.code ?? ''}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteBankQuestion(q.id);
      toast('Question deleted', 'success');
      setPreviewQ(null);
      await reload();
    } catch (e) {
      console.error(e);
      toast('Failed to delete question', 'error');
    } finally { setBusy(false); }
  }

  async function generateCodes() {
    setBusy(true);
    try {
      const n = await backfillQuestionCodes();
      toast(n > 0 ? `Generated codes for ${n} question${n === 1 ? '' : 's'}` : 'All questions already have codes', 'success');
      if (n > 0) await reload();
    } catch (e) {
      console.error(e);
      toast('Failed to generate codes', 'error');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Faculty', href: '/faculty' }, { label: 'Question Bank' }]}
        showSearch={false}
        actions={
          <div className="flex items-center gap-2">
            <Link to={pathFor('faculty')} className="btn-outline btn-md flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setShowAddForm(v => !v)}
              className="btn-primary btn-md flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              Add Question
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Question Bank
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              Every question carries a permanent code (e.g. <span className="font-mono">CC-Q-{new Date().getFullYear()}-00000001</span>) and source metadata
            </p>
          </div>
          {stats.total > stats.coded && (
            <button type="button" onClick={generateCodes} disabled={busy} className="btn-outline btn-md">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>tag</span>
              Generate {stats.total - stats.coded} missing code{stats.total - stats.coded === 1 ? '' : 's'}
            </button>
          )}
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Questions', value: stats.total, icon: 'quiz', color: '#14B8A6' },
            { label: 'With Codes',      value: stats.coded, icon: 'tag', color: '#5B4FE8' },
            { label: 'Verified',        value: stats.verified, icon: 'verified', color: '#10B981' },
            { label: 'Hard Questions',  value: stats.byDiff.Hard ?? 0, icon: 'trending_up', color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${s.color}1A` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
              </div>
              <div className="text-2xl font-bold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{s.value}</div>
              <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <Card title="Repository Filters" subtitle="Search by code, prompt, chapter, topic, uploader, or source">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Search</label>
              <div className="search-bar">
                <span className="material-symbols-outlined text-[18px] shrink-0">search</span>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="CC-Q-…, prompt, chapter, topic, uploader"
                  className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {['All', ...SUBJECTS].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {['All', ...DIFFICULTIES].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Origin</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {['All', ...QUESTION_ORIGINS].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button type="button" onClick={resetFilters} className="btn-ghost btn-sm">Reset filters</button>
          </div>
        </Card>

        {/* Questions table */}
        <Card title="Questions" subtitle={`${rows.length} of ${all.length} shown`} noPad>
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Subject</th>
                    <th>Chapter / Topic</th>
                    <th>Difficulty</th>
                    <th>Origin</th>
                    <th>Uploaded By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(q => {
                    const diffStyle = DIFFICULTY_COLOR[q.difficulty] ?? DIFFICULTY_COLOR.Easy;
                    const verify = VERIFY_COLOR[q.verificationStatus ?? 'unverified'] ?? VERIFY_COLOR.unverified;
                    return (
                      <tr key={q.id}>
                        <td><span className="text-label-sm font-mono font-semibold" style={{ color: q.code ? '#5B4FE8' : 'var(--text-faint)' }}>{q.code ?? '— none —'}</span></td>
                        <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{q.subject || '—'}</span></td>
                        <td>
                          <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{q.chapter || '—'}</div>
                          {q.topic && <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{q.topic}</div>}
                        </td>
                        <td><span className="text-label-sm font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: diffStyle.bg, color: diffStyle.color }}>{q.difficulty}</span></td>
                        <td><span className="text-body-md" style={{ color: 'var(--text-muted)' }}>{q.origin ?? '—'}</span></td>
                        <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{q.uploadedByName || '—'}</span></td>
                        <td><span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{fmtDate(q.createdAt)}</span></td>
                        <td><span className="text-label-sm font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: verify.bg, color: verify.color }}>{verify.label}</span></td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setPreviewQ(q)} className="text-label-sm font-semibold hover:underline" style={{ color: '#14B8A6' }}>Preview</button>
                            <button type="button" onClick={() => openEdit(q)} className="icon-btn icon-btn-sm" title="Edit"><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--text-faint)' }}>
                      {all.length === 0 ? 'No questions in the bank yet. Add one to get started.' : 'No questions match your filters.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Add Question form */}
        {showAddForm && (
          <Card title="Add New Question" subtitle="A unique code is assigned automatically on save">
            <QuestionForm draft={draft} setDraft={setDraft} />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={addQuestion} disabled={busy} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}>
                {busy ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>}
                Save Question
              </button>
              <button type="button" onClick={() => { setShowAddForm(false); setDraft(EMPTY_DRAFT); }} className="btn-outline btn-md">Cancel</button>
            </div>
          </Card>
        )}
      </div>

      {/* Preview modal */}
      {previewQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPreviewQ(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 className="text-title-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Question Preview</h3>
                <span className="text-label-sm font-mono" style={{ color: '#5B4FE8' }}>{previewQ.code ?? 'no code'}</span>
              </div>
              <button type="button" onClick={() => setPreviewQ(null)} className="icon-btn icon-btn-sm"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Subject', value: previewQ.subject },
                  { label: 'Chapter', value: previewQ.chapter },
                  { label: 'Topic', value: previewQ.topic || '—' },
                  { label: 'Difficulty', value: previewQ.difficulty },
                  { label: 'Origin', value: previewQ.origin ?? '—' },
                  { label: 'Uploaded By', value: previewQ.uploadedByName || '—' },
                ].map(f => (
                  <div key={f.label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <div className="text-label-sm uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{f.label}</div>
                    <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <div className="text-label-sm uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Question</div>
                <p className="text-body-md" style={{ color: 'var(--text-primary)' }}>{previewQ.question || '—'}</p>
              </div>
              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as const).map(k => (
                  <div key={k} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: previewQ.answer === k ? 'rgba(16,185,129,0.10)' : 'var(--surface-muted)', border: `1px solid ${previewQ.answer === k ? 'rgba(16,185,129,0.35)' : 'var(--border)'}` }}>
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: previewQ.answer === k ? '#10B981' : 'var(--surface)', color: previewQ.answer === k ? '#fff' : 'var(--text-muted)' }}>{k}</span>
                    <span className="text-body-md" style={{ color: 'var(--text-primary)' }}>{previewQ.options[k] || '—'}</span>
                    {previewQ.answer === k && <span className="material-symbols-outlined ml-auto" style={{ fontSize: 18, color: '#10B981' }}>check_circle</span>}
                  </div>
                ))}
              </div>
              {previewQ.explanation && (
                <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(91,79,232,0.05)', border: '1px solid var(--border)' }}>
                  <div className="text-label-sm uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Explanation</div>
                  <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{previewQ.explanation}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex justify-between gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              {(role === 'admin' || previewQ.uploadedBy === uid) ? (
                <button type="button" onClick={() => removeQuestion(previewQ)} className="btn-outline btn-md" style={{ borderColor: '#EF4444', color: '#EF4444' }}>Delete</button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => { const q = previewQ; setPreviewQ(null); openEdit(q); }} className="btn-outline btn-md">Edit</button>
                <button type="button" onClick={() => setPreviewQ(null)} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setEditQ(null)}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 className="text-title-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Edit Question</h3>
                <span className="text-label-sm font-mono" style={{ color: '#5B4FE8' }}>{editQ.code ?? 'no code'}</span>
              </div>
              <button type="button" onClick={() => setEditQ(null)} className="icon-btn icon-btn-sm"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <QuestionForm draft={editDraft} setDraft={setEditDraft} />
            </div>
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setEditQ(null)} className="btn-outline btn-md">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={busy} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared question form ──────────────────────────────────────────────────────

function QuestionForm({ draft, setDraft }: { draft: Draft; setDraft: Dispatch<SetStateAction<Draft>> }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Question</label>
        <textarea value={draft.question} onChange={e => set('question', e.target.value)} rows={2} placeholder="Enter the question text…" className="input-field w-full resize-none" style={inputStyle} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['A', 'B', 'C', 'D'] as const).map(k => (
          <div key={k}>
            <label className="text-label-sm font-semibold mb-1.5 block flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              Option {k}
              <button type="button" onClick={() => set('answer', k)} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: draft.answer === k ? '#10B981' : 'var(--surface-muted)', color: draft.answer === k ? '#fff' : 'var(--text-faint)' }}>
                {draft.answer === k ? '✓ correct' : 'mark correct'}
              </button>
            </label>
            <input type="text" value={draft[k]} onChange={e => set(k, e.target.value)} className="input-field w-full" style={inputStyle} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
          <select value={draft.subject} onChange={e => set('subject', e.target.value)} className="input-field w-full" style={inputStyle}>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Chapter</label>
          <input type="text" value={draft.chapter} onChange={e => set('chapter', e.target.value)} placeholder="e.g. Kinematics" className="input-field w-full" style={inputStyle} />
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Topic</label>
          <input type="text" value={draft.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Projectile motion" className="input-field w-full" style={inputStyle} />
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
          <select value={draft.difficulty} onChange={e => set('difficulty', e.target.value as Draft['difficulty'])} className="input-field w-full" style={inputStyle}>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Origin</label>
          <select value={draft.origin} onChange={e => set('origin', e.target.value as QuestionOrigin)} className="input-field w-full" style={inputStyle}>
            {QUESTION_ORIGINS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Explanation (optional)</label>
        <textarea value={draft.explanation} onChange={e => set('explanation', e.target.value)} rows={2} placeholder="Why the correct answer is correct…" className="input-field w-full resize-none" style={inputStyle} />
      </div>
    </div>
  );
}
