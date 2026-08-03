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

const STEPS = ['Method', 'Configuration', 'Blueprint', 'Security', 'Preview', 'Publish'] as const;

export default function CreateTest() {
  const navigate = useNavigate();
  const toast    = useToast();
  const confirm  = useConfirm();
  const session  = getAuthSession();
  const uid      = session?.user?.id ?? '';

  const [step, setStep] = useState(0);

  const [stream, setStream] = useState<StudentStream>((getStudentStream() ?? 'JEE'));
  const subjects = STREAM_SUBJECTS[stream] ?? STREAM_SUBJECTS.JEE;

  const [type, setType]               = useState<TestType>('faculty_batch');
  const [title, setTitle]             = useState('');
  // Multi-subject selection (3b)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, string[]>>({});
  const [selectedChapters, setSelectedChapters]   = useState<Record<string, string[]>>({});
  const [chapterSearch, setChapterSearch]         = useState('');
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

  function goNext() { setStep(s => Math.min(STEPS.length - 1, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function goBack()  { setStep(s => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }

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

      {/* Step tracker — real paginated wizard; each step below is only mounted when active. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((label, i, arr) => (
          <div key={label} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => { if (i <= step) setStep(i); }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ cursor: i <= step ? 'pointer' : 'default' }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={i === step
                  ? { background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))', color: '#fff' }
                  : i < step
                    ? { backgroundColor: 'var(--faculty-accent-muted)', color: 'var(--faculty-accent)' }
                    : { backgroundColor: 'var(--surface-muted)', color: 'var(--text-faint)' }}
              >
                {i < step ? <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span> : i + 1}
              </span>
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: i === step ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
            </button>
            {i < arr.length - 1 && <span className="w-6 h-px shrink-0" style={{ backgroundColor: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1 — Method ═══ */}
      {step === 0 && (
        <div className="space-y-6">
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
                    border: `1.5px solid ${active ? 'var(--faculty-accent)' : 'var(--border)'}`,
                    cursor: active ? 'default' : 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--faculty-accent)' }}>{m.icon}</span>
                  <div className="text-sm font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
                    {m.title}
                    {active && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(20,184,166,0.14)', color: 'var(--faculty-accent-hover)' }}>SELECTED</span>}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{m.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Stream</label>
            <div className="flex gap-3">
              {STREAMS.map(s => (
                <button key={s} type="button"
                  onClick={() => { setStream(s); setSelectedSubjects([]); setSelectedChapters({}); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    backgroundColor: stream === s ? 'var(--faculty-accent)' : 'var(--surface)',
                    color:           stream === s ? '#fff'    : 'var(--text-muted)',
                    border:          `1.5px solid ${stream === s ? 'var(--faculty-accent)' : 'var(--border)'}`,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

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
                    border: `1.5px solid ${type === opt.val ? 'var(--faculty-accent)' : 'var(--border)'}`,
                  }}
                >
                  <span className="material-symbols-outlined mt-0.5" style={{ fontSize: 20, color: 'var(--faculty-accent)' }}>{opt.icon}</span>
                  <span>
                    <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
              Test Title <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="e.g. Weekly Physics + Chemistry Mock 4"
              className="input-field w-full"
              style={inputStyle}
            />
          </div>

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
                      backgroundColor: active ? 'var(--faculty-accent)' : 'var(--surface)',
                      color:           active ? '#fff'    : 'var(--text-muted)',
                      border:          `1.5px solid ${active ? 'var(--faculty-accent)' : 'var(--border)'}`,
                    }}>
                    {active && <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 2 — Configuration ═══ */}
      {step === 1 && (
        <div className="space-y-6">
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
                  style={{ backgroundColor: negativeMarking ? 'var(--faculty-accent)' : 'var(--border)' }}
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
        </div>
      )}

      {/* ═══ STEP 3 — Blueprint (chapter selection, per selected subject) ═══ */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
              Chapters {totalChaptersSelected > 0 && <span className="normal-case font-medium">({totalChaptersSelected} selected)</span>}
            </label>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Questions are pulled proportionally to how many chapters you pick per subject.</p>
          </div>
          {selectedSubjects.length === 0 && (
            <p className="text-body-sm rounded-xl p-4" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              Go back to Method and select at least one subject first.
            </p>
          )}
          {loadingCh && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Spinner size={14} color="var(--faculty-accent)" /> Loading chapters…
            </div>
          )}
          {selectedSubjects.length > 0 && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: 'var(--text-faint)' }}>search</span>
              <input
                type="text"
                value={chapterSearch}
                onChange={e => setChapterSearch(e.target.value)}
                placeholder="Search chapters…"
                className="w-full rounded-xl pl-10 pr-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          {selectedSubjects.map(subj => {
            const allChapters = chaptersBySubject[subj] ?? [];
            const query = chapterSearch.trim().toLowerCase();
            const visibleChapters = query
              ? allChapters.filter(ch => ch.toLowerCase().includes(query))
              : allChapters;
            return (
            <div key={subj} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{subj}</span>
                {allChapters.length > 0 && (
                  <button
                    type="button"
                    className="text-label-sm font-semibold hover:underline"
                    style={{ color: 'var(--faculty-accent)' }}
                    onClick={() => setSelectedChapters(prev => ({
                      ...prev,
                      [subj]: (prev[subj] ?? []).length === allChapters.length ? [] : [...allChapters],
                    }))}
                  >
                    {(selectedChapters[subj] ?? []).length === allChapters.length ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {visibleChapters.map(ch => {
                  const active = (selectedChapters[subj] ?? []).includes(ch);
                  return (
                    <button key={ch} type="button" onClick={() => toggleChapter(subj, ch)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: active ? 'rgba(20,184,166,0.12)' : 'var(--surface-muted)',
                        color:           active ? 'var(--faculty-accent-hover)' : 'var(--text-muted)',
                        border:          `1px solid ${active ? 'var(--faculty-accent)' : 'var(--border)'}`,
                      }}>
                      {ch}
                    </button>
                  );
                })}
                {!loadingCh && allChapters.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>No chapters found for {subj} yet.</span>
                )}
                {!loadingCh && allChapters.length > 0 && visibleChapters.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>No chapters match "{chapterSearch.trim()}".</span>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ═══ STEP 4 — Security ═══ */}
      {step === 3 && (
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
                  border: `1.5px solid ${lockMode === opt.val ? 'var(--faculty-accent)' : 'var(--border)'}`,
                }}
              >
                <span className="material-symbols-outlined mt-0.5" style={{ fontSize: 20, color: 'var(--faculty-accent)' }}>{opt.icon}</span>
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
      )}

      {/* ═══ STEP 5 — Preview (real configured values, not a fabricated AI prediction) ═══ */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { v: difficulty, l: 'Difficulty' },
              { v: `${durationMins} min`, l: 'Duration' },
              { v: String(count), l: 'Questions' },
              { v: `${selectedSubjects.length} subject${selectedSubjects.length === 1 ? '' : 's'}`, l: 'Coverage' },
            ].map(m => (
              <div key={m.l} className="text-center rounded-xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <div className="text-lg font-extrabold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--faculty-accent)' }}>{m.v}</div>
                <div className="text-label-sm mt-1" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-label-sm font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-faint)' }}>Summary</div>
            <div className="text-body-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>{title.trim() || 'Untitled test'}</strong></div>
              <div>{selectedSubjects.map(s => `${s} (${(selectedChapters[s] ?? []).length} ch.)`).join(', ') || 'No subjects selected'}</div>
              <div>{negativeMarking ? '+4 / −1 marking' : 'No negative marking'} · {lockMode === 'locked' ? 'Complete Lock Mode' : 'Tab switching allowed'}</div>
              <div>{type === 'faculty_coaching' ? 'Requires admin approval before it goes live' : 'Assigned directly to your students on publish'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 6 — Publish ═══ */}
      {step === 5 && (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>rocket_launch</span>
          </div>
          <h2 className="text-headline-sm font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>Ready to publish</h2>
          <p className="text-body-sm max-w-md mx-auto mb-6" style={{ color: 'var(--text-muted)' }}>
            {type === 'faculty_coaching'
              ? 'This test will be sent to an admin for approval before it goes live.'
              : 'This test will be assigned to your students as soon as you publish. You can still edit it from My Tests afterward.'}
          </p>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="btn-primary btn-md justify-center px-8"
            style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}
          >
            {submitting ? <Spinner size={16} color="#fff" /> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>}
            {submitting ? 'Creating…' : type === 'faculty_coaching' ? 'Submit for Approval' : 'Create & Publish Test'}
          </button>
        </div>
      )}

      {/* Wizard navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={goBack}
          className="btn-secondary btn-md"
          style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
        >
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            className="btn-primary btn-md"
            style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
