import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream, STREAM_SUBJECTS, type StudentStream } from '../../lib/stream';
import { getChaptersForSubject } from '../../lib/questions';
import { getQuestionsForCustomTest } from '../../lib/questions';
import { createTest, type TestType, type Difficulty, type LockMode } from '../../lib/tests';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import Spinner from '../../components/Spinner';

const STREAMS: StudentStream[] = ['JEE', 'NEET'];
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Mixed'];

// One Create Test entry point (3d): the classic question-bank test lives here,
// and the other authoring methods are one click away.
const METHODS = [
  { key: 'bank',   icon: 'library_books', title: 'Question Bank Test', desc: 'Auto-pick questions from the repository by subject, chapter & difficulty.' },
  { key: 'ai',     icon: 'auto_awesome',  title: 'AI Test Generator',  desc: 'Generate fresh exam-quality questions with AI to your exact blueprint.' },
  { key: 'manual', icon: 'construction',  title: 'Build Manually',     desc: 'Hand-pick every question, with per-question marks and timing.' },
] as const;

export default function CreateTest() {
  const navigate = useNavigate();
  const toast    = useToast();
  const confirm  = useConfirm();
  const session  = getAuthSession();
  const uid      = session?.user?.id ?? '';

  const [stream, setStream] = useState<StudentStream>((getStudentStream() ?? 'JEE'));
  const subjects = STREAM_SUBJECTS[stream] ?? STREAM_SUBJECTS.JEE;

  const [type, setType]               = useState<TestType>('faculty_batch');
  const [title, setTitle]             = useState('');
  // Multi-subject selection (3b)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, string[]>>({});
  const [selectedChapters, setSelectedChapters]   = useState<Record<string, string[]>>({});
  const [loadingCh, setLoadingCh]     = useState(false);
  const [difficulty, setDifficulty]   = useState<Difficulty>('Mixed');
  const [count, setCount]             = useState(30);
  const [durationMins, setDurationMins] = useState(45);
  const [startAt, setStartAt]         = useState('');
  const [endAt, setEndAt]             = useState('');
  const [instructions, setInstructions] = useState('');
  const [negativeMarking, setNeg]     = useState(false);
  const [lockMode, setLockMode]       = useState<LockMode>('locked');
  const [autoSubmitViolations, setAutoSubmit] = useState(2);
  const [submitting, setSubmitting]   = useState(false);

  const totalChaptersSelected = Object.values(selectedChapters).reduce((n, arr) => n + arr.length, 0);

  // Load chapters for every selected subject
  useEffect(() => {
    if (selectedSubjects.length === 0) return;
    const missing = selectedSubjects.filter(s => !(s in chaptersBySubject));
    if (missing.length === 0) return;
    setLoadingCh(true);
    Promise.all(missing.map(async s => [s, (await getChaptersForSubject(s)).map(c => c.chapter)] as [string, string[]]))
      .then(entries => setChaptersBySubject(prev => ({ ...prev, ...Object.fromEntries(entries) })))
      .finally(() => setLoadingCh(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjects]);

  function toggleSubject(s: string) {
    setSelectedSubjects(prev => {
      if (prev.includes(s)) {
        setSelectedChapters(c => { const n = { ...c }; delete n[s]; return n; });
        return prev.filter(x => x !== s);
      }
      return [...prev, s];
    });
  }

  function toggleChapter(subj: string, ch: string) {
    setSelectedChapters(prev => {
      const cur = prev[subj] ?? [];
      return { ...prev, [subj]: cur.includes(ch) ? cur.filter(x => x !== ch) : [...cur, ch] };
    });
  }

  async function handleSubmit() {
    if (!title.trim()) { toast('Test title is required', 'error'); return; }
    if (selectedSubjects.length === 0) { toast('Select at least one subject', 'error'); return; }
    if (totalChaptersSelected === 0) { toast('Select at least one chapter', 'error'); return; }

    // Confirmation before publishing / submitting (3e)
    const summary = selectedSubjects.map(s => `${s} (${(selectedChapters[s] ?? []).length} ch.)`).join(', ');
    const ok = await confirm({
      title: type === 'faculty_coaching' ? 'Submit test for approval?' : 'Create and publish this test?',
      message: `"${title.trim()}" — ${summary} · ${count} questions · ${durationMins} min · ${lockMode === 'locked' ? 'Complete Lock Mode' : 'Tab switching allowed'}.`,
      confirmLabel: type === 'faculty_coaching' ? 'Submit for approval' : 'Create test',
      icon: 'quiz',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      // Pull questions per subject, proportional to its share of selected chapters (3b)
      const allIds: string[] = [];
      await Promise.all(selectedSubjects.map(async subject => {
        const chapters = selectedChapters[subject] ?? [];
        if (chapters.length === 0) return;
        const perSubject = Math.max(5, Math.round(count * (chapters.length / totalChaptersSelected)));
        const { questionIds } = await getQuestionsForCustomTest({ subject, chapters, difficulty, count: perSubject });
        allIds.push(...questionIds);
      }));

      if (allIds.length === 0) {
        toast('No questions available for your selection', 'error');
        setSubmitting(false);
        return;
      }

      // Shuffle across subjects and cap at the requested length
      for (let i = allIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
      }
      const finalIds = allIds.slice(0, count);
      const allChapters = selectedSubjects.flatMap(s => selectedChapters[s] ?? []);

      const status = type === 'faculty_coaching' ? 'pending_approval' : 'active';
      await createTest({
        type,
        status,
        title: title.trim(),
        createdBy: uid,
        subjects:  [...selectedSubjects],
        chapters:  allChapters,
        difficulty,
        questionCount:   finalIds.length,
        durationSeconds: durationMins * 60,
        startAt:   startAt || new Date().toISOString(),
        endAt:     endAt   || null,
        instructions: instructions.trim(),
        negativeMarking,
        lockMode,
        autoSubmitViolations: lockMode === 'locked' ? autoSubmitViolations : 0,
        assignedTo: 'all',
        questionIds: finalIds,
        stream,
      });
      const msg = type === 'faculty_coaching'
        ? 'Test submitted for admin approval!'
        : 'Test created and activated!';
      toast(msg, 'success');
      navigate(pathFor('manageTests'));
    } catch (err) {
      console.error(err);
      toast('Failed to create test. Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Create Test
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          All test creation methods in one place — pick how you want to build this paper
        </p>
      </div>

      {/* Method chooser (3d) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {METHODS.map(m => {
          const active = m.key === 'bank';
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                if (m.key === 'ai') navigate(pathFor('aiGenerate'));
                else if (m.key === 'manual') navigate(pathFor('buildTest'));
              }}
              className="text-left rounded-2xl p-4 transition-all"
              style={{
                backgroundColor: active ? 'rgba(20,184,166,0.06)' : 'var(--surface)',
                border: `1.5px solid ${active ? '#14B8A6' : 'var(--border)'}`,
                cursor: active ? 'default' : 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#14B8A6' }}>{m.icon}</span>
              <div className="text-sm font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
                {m.title}
                {active && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(20,184,166,0.14)', color: '#0D9488' }}>SELECTED</span>}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{m.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Stream */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Stream</label>
        <div className="flex gap-3">
          {STREAMS.map(s => (
            <button key={s} type="button"
              onClick={() => { setStream(s); setSelectedSubjects([]); setSelectedChapters({}); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                backgroundColor: stream === s ? '#14B8A6' : 'var(--surface)',
                color:           stream === s ? '#fff'    : 'var(--text-muted)',
                border:          `1.5px solid ${stream === s ? '#14B8A6' : 'var(--border)'}`,
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Test type */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Test Type</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { val: 'faculty_batch',    label: 'Batch Test',    desc: 'Assign directly to your students', icon: 'group' },
            { val: 'faculty_coaching', label: 'Coaching Test', desc: 'Requires admin approval first',   icon: 'verified' },
          ] as const).map(opt => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setType(opt.val)}
              className="text-left rounded-2xl p-4 flex gap-3 items-start transition-all"
              style={{
                backgroundColor: type === opt.val ? 'rgba(20,184,166,0.06)' : 'var(--surface)',
                border: `1.5px solid ${type === opt.val ? '#14B8A6' : 'var(--border)'}`,
              }}
            >
              <span className="material-symbols-outlined mt-0.5" style={{ fontSize: 20, color: '#14B8A6' }}>{opt.icon}</span>
              <span>
                <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Test Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Weekly Physics + Chemistry Mock 4"
          className="input-field w-full"
          style={inputStyle}
        />
      </div>

      {/* Subjects — multiple selection (3b) */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
          Subjects <span className="normal-case font-medium">(select one or more)</span>
        </label>
        <div className="flex gap-3 flex-wrap">
          {subjects.map(s => {
            const active = selectedSubjects.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleSubject(s)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                style={{
                  backgroundColor: active ? '#14B8A6' : 'var(--surface)',
                  color:           active ? '#fff'    : 'var(--text-muted)',
                  border:          `1.5px solid ${active ? '#14B8A6' : 'var(--border)'}`,
                }}>
                {active && <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>}
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapters per selected subject */}
      {selectedSubjects.length > 0 && (
        <div className="space-y-3">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
            Chapters {totalChaptersSelected > 0 && <span className="normal-case font-medium">({totalChaptersSelected} selected)</span>}
          </label>
          {loadingCh && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Spinner size={14} color="#14B8A6" /> Loading chapters…
            </div>
          )}
          {selectedSubjects.map(subj => (
            <div key={subj} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{subj}</span>
                {(chaptersBySubject[subj] ?? []).length > 0 && (
                  <button
                    type="button"
                    className="text-label-sm font-semibold hover:underline"
                    style={{ color: '#14B8A6' }}
                    onClick={() => setSelectedChapters(prev => ({
                      ...prev,
                      [subj]: (prev[subj] ?? []).length === (chaptersBySubject[subj] ?? []).length ? [] : [...(chaptersBySubject[subj] ?? [])],
                    }))}
                  >
                    {(selectedChapters[subj] ?? []).length === (chaptersBySubject[subj] ?? []).length ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {(chaptersBySubject[subj] ?? []).map(ch => {
                  const active = (selectedChapters[subj] ?? []).includes(ch);
                  return (
                    <button key={ch} type="button" onClick={() => toggleChapter(subj, ch)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: active ? 'rgba(20,184,166,0.12)' : 'var(--surface-muted)',
                        color:           active ? '#0D9488' : 'var(--text-muted)',
                        border:          `1px solid ${active ? '#14B8A6' : 'var(--border)'}`,
                      }}>
                      {ch}
                    </button>
                  );
                })}
                {!loadingCh && (chaptersBySubject[subj] ?? []).length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>No chapters found for {subj} yet.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Config grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)} className="input-field w-full" style={inputStyle}>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Questions</label>
          <select value={count} onChange={e => setCount(Number(e.target.value))} className="input-field w-full" style={inputStyle}>
            {[10, 20, 30, 45, 60, 90].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Duration (minutes)</label>
          <input type="number" min={5} max={300} value={durationMins} onChange={e => setDurationMins(Number(e.target.value))} className="input-field w-full" style={inputStyle} />
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Negative Marking</label>
          <button
            type="button"
            onClick={() => setNeg(v => !v)}
            className="input-field w-full flex items-center justify-between"
            style={inputStyle}
          >
            <span className="text-sm">{negativeMarking ? '+4 / −1 marking' : 'No negative marking'}</span>
            <span
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{ backgroundColor: negativeMarking ? '#14B8A6' : 'var(--border)' }}
            >
              <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform" style={{ transform: negativeMarking ? 'translateX(18px)' : 'translateX(2px)' }} />
            </span>
          </button>
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Start (optional)</label>
          <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="input-field w-full" style={inputStyle} />
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>End (optional)</label>
          <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className="input-field w-full" style={inputStyle} />
        </div>
      </div>

      {/* Browser security mode (Feature 2) */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Browser Security</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { val: 'locked', label: 'Complete Lock Mode', desc: 'Copy/paste, right-click & dev-tools blocked; tab switches warned and can auto-submit', icon: 'lock' },
            { val: 'open',   label: 'Allow Tab Switching', desc: 'Nothing blocked — every switch is recorded and flagged for you', icon: 'lock_open' },
          ] as const).map(opt => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setLockMode(opt.val)}
              className="text-left rounded-2xl p-4 flex gap-3 items-start transition-all"
              style={{
                backgroundColor: lockMode === opt.val ? 'rgba(20,184,166,0.06)' : 'var(--surface)',
                border: `1.5px solid ${lockMode === opt.val ? '#14B8A6' : 'var(--border)'}`,
              }}
            >
              <span className="material-symbols-outlined mt-0.5" style={{ fontSize: 20, color: '#14B8A6' }}>{opt.icon}</span>
              <span>
                <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {lockMode === 'locked' && (
          <div className="flex items-center gap-3 pt-1">
            <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Auto-submit after</label>
            <select value={autoSubmitViolations} onChange={e => setAutoSubmit(Number(e.target.value))} className="input-field" style={inputStyle}>
              <option value={0}>Never</option>
              {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n} tab switch{n > 1 ? 'es' : ''}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={3}
          placeholder="Any special instructions for students…"
          className="input-field w-full resize-none"
          style={inputStyle}
        />
      </div>

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="btn-primary btn-md w-full justify-center"
        style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
      >
        {submitting ? <Spinner size={16} color="#fff" /> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>}
        {submitting ? 'Creating…' : type === 'faculty_coaching' ? 'Submit for Approval' : 'Create & Publish Test'}
      </button>
    </div>
  );
}
