import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  listBankQuestions,
  createBankQuestion,
  updateBankQuestion,
  deleteBankQuestion,
  backfillQuestionCodes,
  type BankQuestion,
} from '../../lib/questionBank';
import MathText from '../../components/MathText';
import QuestionForm, { SUBJECTS, DIFFICULTIES, EMPTY_DRAFT, type Draft } from '../../components/QuestionForm';

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

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const QUESTIONS_PER_PAGE = 10;

export default function QuestionBankManagement() {
  const toast   = useToast();
  const confirm = useConfirm();
  const session = getAuthSession();
  const uid     = session?.user?.id ?? '';
  const uname   = session?.user?.name ?? 'Faculty';
  const role    = session?.user?.role ?? 'faculty';

  const [all, setAll]         = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  const [search, setSearch]         = useState('');
  const [subject, setSubject]       = useState('All');
  const [chapter, setChapter]       = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [origin, setOrigin]         = useState('All');
  const [page, setPage]             = useState(1);

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

  // Subject match is strict (trimmed) so e.g. Biology and Mathematics questions
  // can never bleed into each other's filtered views (3g).
  const rows = useMemo(() => all.filter(q => {
    const matchesSubject    = subject    === 'All' || (q.subject ?? '').trim() === subject;
    const matchesChapter    = chapter    === 'All' || (q.chapter ?? '').trim() === chapter;
    const matchesDifficulty = difficulty === 'All' || q.difficulty === difficulty;
    // Case-insensitive so a stored "ALLEN" still matches a filter of "Allen" (etc.)
    const matchesOrigin     = origin     === 'All' || (q.origin ?? '').trim().toLowerCase() === origin.trim().toLowerCase();
    const s = search.toLowerCase();
    const matchesSearch = !s ||
      (q.code ?? '').toLowerCase().includes(s) ||
      q.question.toLowerCase().includes(s) ||
      q.chapter.toLowerCase().includes(s) ||
      (q.topic ?? '').toLowerCase().includes(s) ||
      (q.uploadedByName ?? '').toLowerCase().includes(s);
    return matchesSubject && matchesChapter && matchesDifficulty && matchesOrigin && matchesSearch;
  }), [all, subject, chapter, difficulty, origin, search]);

  // Chapter options follow the selected subject, so unrelated chapters never mix (3g).
  const chapterOptions = useMemo(() => {
    const set = new Set<string>();
    all.forEach(q => {
      if (subject === 'All' || (q.subject ?? '').trim() === subject) {
        const c = (q.chapter ?? '').trim();
        if (c) set.add(c);
      }
    });
    return [...set].sort();
  }, [all, subject]);

  // Origin options are built from the ACTUAL origins in the bank (case-preserved),
  // so the dropdown label always matches the stored value and filtering works —
  // e.g. it shows "ALLEN" if that's how the data was saved, not a mismatched "Allen".
  const originOptions = useMemo(() => {
    const map = new Map<string, string>();  // lowercase key → display value
    all.forEach(q => {
      const o = (q.origin ?? '').trim();
      if (o && !map.has(o.toLowerCase())) map.set(o.toLowerCase(), o);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [all]);

  // Question viewing is paginated (3j) — reset to page 1 when filters change.
  useEffect(() => { setPage(1); }, [subject, chapter, difficulty, origin, search]);
  const totalPages = Math.max(1, Math.ceil(rows.length / QUESTIONS_PER_PAGE));
  const pagedRows  = rows.slice((page - 1) * QUESTIONS_PER_PAGE, page * QUESTIONS_PER_PAGE);

  const stats = useMemo(() => {
    const total = all.length;
    const coded = all.filter(q => q.code).length;
    const verified = all.filter(q => q.verificationStatus === 'verified').length;
    const byDiff = { Easy: 0, Medium: 0, Hard: 0 } as Record<string, number>;
    all.forEach(q => { byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1; });
    return { total, coded, verified, byDiff };
  }, [all]);

  function resetFilters() { setSearch(''); setSubject('All'); setChapter('All'); setDifficulty('All'); setOrigin('All'); }

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
      imageUrl: d.imageUrl,
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
      difficulty: q.difficulty, origin: (q.origin as Draft['origin']) ?? 'Custom',
      explanation: q.explanation ?? '', imageUrl: q.imageUrl ?? '',
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
    const ok = await confirm({
      title: 'Delete this question?',
      message: `${q.code ?? 'This question'} will be permanently removed from the repository. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      icon: 'delete',
    });
    if (!ok) return;
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
              style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}
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
            { label: 'Total Questions', value: stats.total, icon: 'quiz', color: 'var(--faculty-accent)' }, // hex literal — concatenated with an alpha suffix below
            { label: 'With Codes',      value: stats.coded, icon: 'tag', color: '#6B5EF0' }, // hex literal — concatenated with an alpha suffix below
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
              <select value={subject} onChange={e => { setSubject(e.target.value); setChapter('All'); }} className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {['All', ...SUBJECTS].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Chapter</label>
              <select value={chapter} onChange={e => setChapter(e.target.value)} className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {['All', ...chapterOptions].map(c => <option key={c}>{c}</option>)}
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
                {['All', ...originOptions].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button type="button" onClick={resetFilters} className="btn-ghost btn-sm">Reset filters</button>
          </div>
        </Card>

        {/* Question cards — paginated (3j) with correct serial numbers (3h) */}
        <Card title="Questions" subtitle={`${rows.length} of ${all.length} shown · page ${page} of ${totalPages}`}>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />)}
            </div>
          ) : (
            <div className="space-y-3">
              {pagedRows.map((q, i) => {
                const diffStyle = DIFFICULTY_COLOR[q.difficulty] ?? DIFFICULTY_COLOR.Easy;
                const verify = VERIFY_COLOR[q.verificationStatus ?? 'unverified'] ?? VERIFY_COLOR.unverified;
                const serial = (page - 1) * QUESTIONS_PER_PAGE + i + 1;
                return (
                  <div key={q.id} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-label-sm font-bold" style={{ color: 'var(--text-faint)' }}>#{serial}</span>
                        <span className="text-label-sm font-mono font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: q.code ? 'var(--faculty-accent-muted)' : 'var(--surface)', color: q.code ? 'var(--faculty-accent-hover)' : 'var(--text-faint)' }}>{q.code ?? '— none —'}</span>
                        <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: verify.bg, color: verify.color }}>{verify.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => setPreviewQ(q)} className="text-label-sm font-semibold hover:underline" style={{ color: 'var(--faculty-accent)' }}>Preview</button>
                        <button type="button" onClick={() => openEdit(q)} className="icon-btn icon-btn-sm" title="Edit"><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span></button>
                      </div>
                    </div>
                    <p className="text-body-md font-medium mb-3" style={{ color: 'var(--text-primary)' }}><MathText text={q.question} /></p>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      {[
                        { l: 'Subject', v: q.subject || '—' },
                        { l: 'Chapter', v: q.chapter || '—' },
                        { l: 'Difficulty', v: q.difficulty, color: diffStyle.color },
                        { l: 'Origin', v: q.origin ?? '—' },
                        { l: 'Uploaded By', v: q.uploadedByName || '—' },
                        { l: 'Date', v: fmtDate(q.createdAt) },
                      ].map(m => (
                        <div key={m.l}>
                          <div className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>{m.l}</div>
                          <div className="text-label-lg font-semibold mt-0.5 truncate" style={{ color: m.color ?? 'var(--text-secondary)' }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <p className="text-center py-10" style={{ color: 'var(--text-faint)' }}>
                  {all.length === 0 ? 'No questions in the bank yet. Add one to get started.' : 'No questions match your filters.'}
                </p>
              )}
            </div>
          )}

          {/* Pager */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                Showing {(page - 1) * QUESTIONS_PER_PAGE + 1}–{Math.min(page * QUESTIONS_PER_PAGE, rows.length)} of {rows.length}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="icon-btn icon-btn-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_left</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page - 2 + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-md text-sm font-semibold transition-colors"
                      style={p === page ? { backgroundColor: 'var(--faculty-accent)', color: '#fff' } : { color: 'var(--text-muted)' }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="icon-btn icon-btn-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Add Question form */}
        {showAddForm && (
          <Card title="Add New Question" subtitle="A unique code is assigned automatically on save">
            <QuestionForm draft={draft} setDraft={setDraft} uid={uid} />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={addQuestion} disabled={busy} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}>
                {busy ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>}
                Save Question
              </button>
              <button type="button" onClick={() => { setShowAddForm(false); setDraft(EMPTY_DRAFT); }} className="btn-outline btn-md">Cancel</button>
            </div>
          </Card>
        )}
      </div>

      {/* Preview modal — landscape layout (3i): question left, options right */}
      {previewQ && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPreviewQ(null)}>
          <div className="w-full max-w-5xl rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-title-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Question Preview</h3>
                <span className="text-label-sm font-mono" style={{ color: 'var(--faculty-accent)' }}>{previewQ.code ?? 'no code'}</span>
                <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }}>
                  {previewQ.subject} · {previewQ.chapter}{previewQ.topic && previewQ.topic.trim().toLowerCase() !== (previewQ.chapter ?? '').trim().toLowerCase() ? ` · ${previewQ.topic}` : ''}
                </span>
                <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: (DIFFICULTY_COLOR[previewQ.difficulty] ?? DIFFICULTY_COLOR.Easy).bg, color: (DIFFICULTY_COLOR[previewQ.difficulty] ?? DIFFICULTY_COLOR.Easy).color }}>
                  {previewQ.difficulty}
                </span>
              </div>
              <button type="button" onClick={() => setPreviewQ(null)} className="icon-btn icon-btn-sm"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
              {/* Left: question + explanation */}
              <div className="space-y-4">
                <div className="rounded-lg p-4 h-full min-h-[120px]" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="text-label-sm uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)' }}>Question</div>
                  {previewQ.imageUrl && (
                    <img src={previewQ.imageUrl} alt="Question figure" className="rounded-lg max-h-56 mb-3" style={{ border: '1px solid var(--border)' }} />
                  )}
                  <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}><MathText text={previewQ.question || '—'} /></p>
                  {previewQ.explanation && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px dashed var(--border)' }}>
                      <div className="text-label-sm uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Explanation</div>
                      <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}><MathText text={previewQ.explanation} /></p>
                    </div>
                  )}
                </div>
              </div>
              {/* Right: options + meta */}
              <div className="space-y-4">
                <div className="space-y-2">
                  {(['A', 'B', 'C', 'D'] as const).map(k => (
                    <div key={k} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: previewQ.answer === k ? 'rgba(16,185,129,0.10)' : 'var(--surface-muted)', border: `1px solid ${previewQ.answer === k ? 'rgba(16,185,129,0.35)' : 'var(--border)'}` }}>
                      <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: previewQ.answer === k ? '#10B981' : 'var(--surface)', color: previewQ.answer === k ? '#fff' : 'var(--text-muted)' }}>{k}</span>
                      <span className="text-body-md" style={{ color: 'var(--text-primary)' }}><MathText text={previewQ.options[k] || '—'} /></span>
                      {previewQ.answer === k && <span className="material-symbols-outlined ml-auto" style={{ fontSize: 18, color: '#10B981' }}>check_circle</span>}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Origin', value: previewQ.origin ?? '—' },
                    { label: 'Uploaded By', value: previewQ.uploadedByName || '—' },
                  ].map(f => (
                    <div key={f.label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                      <div className="text-label-sm uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{f.label}</div>
                      <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-between gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              {(role === 'admin' || previewQ.uploadedBy === uid) ? (
                <button type="button" onClick={() => removeQuestion(previewQ)} className="btn-outline btn-md" style={{ borderColor: '#EF4444', color: '#EF4444' }}>Delete</button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => { const q = previewQ; setPreviewQ(null); openEdit(q); }} className="btn-outline btn-md">Edit</button>
                <button type="button" onClick={() => setPreviewQ(null)} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}>Close</button>
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
                <span className="text-label-sm font-mono" style={{ color: 'var(--faculty-accent)' }}>{editQ.code ?? 'no code'}</span>
              </div>
              <button type="button" onClick={() => setEditQ(null)} className="icon-btn icon-btn-sm"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <QuestionForm draft={editDraft} setDraft={setEditDraft} uid={uid} />
            </div>
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setEditQ(null)} className="btn-outline btn-md">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={busy} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
