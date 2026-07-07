import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getChaptersForSubject } from '../../lib/questions';
import { getQuestionsForCustomTest } from '../../lib/questions';
import { createTest, type TestType, type Difficulty, type LockMode } from '../../lib/tests';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';

const STREAM_SUBJECTS: Record<string, string[]> = {
  JEE:  ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
};

const STREAMS = ['JEE', 'NEET'] as const;

export default function CreateTest() {
  const navigate = useNavigate();
  const toast    = useToast();
  const session  = getAuthSession();
  const uid      = session?.user?.id ?? '';

  const [stream, setStream]           = useState<string>(getStudentStream() ?? 'JEE');
  const subjects = STREAM_SUBJECTS[stream] ?? STREAM_SUBJECTS.JEE;

  const [type, setType]               = useState<TestType>('faculty_batch');
  const [title, setTitle]             = useState('');
  const [subject, setSubject]         = useState(STREAM_SUBJECTS[getStudentStream() ?? 'JEE'][0]);
  const [chapters, setChapters]       = useState<string[]>([]);
  const [allChapters, setAllChapters] = useState<string[]>([]);
  const [difficulty, setDifficulty]   = useState<Difficulty>('Mixed');
  const [count, setCount]             = useState(30);
  const [durationMins, setDurationMins] = useState(45);
  const [startAt, setStartAt]         = useState('');
  const [endAt, setEndAt]             = useState('');
  const [instructions, setInstructions] = useState('');
  const [negativeMarking, setNeg]     = useState(false);
  const [lockMode, setLockMode]       = useState<LockMode>('locked');
  const [autoSubmitViolations, setAutoSubmit] = useState(2);
  const [loadingCh, setLoadingCh]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    setChapters([]);
    setLoadingCh(true);
    getChaptersForSubject(subject)
      .then(ch => setAllChapters(ch.map(c => c.chapter)))
      .finally(() => setLoadingCh(false));
  }, [subject]);

  function toggleChapter(ch: string) {
    setChapters(p => p.includes(ch) ? p.filter(x => x !== ch) : [...p, ch]);
  }

  async function handleSubmit() {
    if (!title.trim())       { toast('Test title is required', 'error'); return; }
    if (chapters.length === 0) { toast('Select at least one chapter', 'error'); return; }
    setSubmitting(true);
    try {
      const { questionIds, questions } = await getQuestionsForCustomTest({
        subject, chapters, difficulty, count,
      });
      if (questionIds.length === 0) {
        toast('No questions available for your selection', 'error');
        setSubmitting(false);
        return;
      }
      const status = type === 'faculty_coaching' ? 'pending_approval' : 'active';
      await createTest({
        type,
        status,
        title: title.trim(),
        createdBy: uid,
        subjects:  [subject],
        chapters,
        difficulty,
        questionCount:   questions.length,
        durationSeconds: durationMins * 60,
        startAt:   startAt || new Date().toISOString(),
        endAt:     endAt   || null,
        instructions: instructions.trim(),
        negativeMarking,
        lockMode,
        autoSubmitViolations: lockMode === 'locked' ? autoSubmitViolations : 0,
        assignedTo: 'all',
        questionIds,
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Create Test
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Build and assign a test to your students
        </p>
      </div>

      {/* Stream */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Stream</label>
        <div className="flex gap-3">
          {STREAMS.map(s => (
            <button key={s} type="button" onClick={() => { setStream(s); setSubject(STREAM_SUBJECTS[s][0]); setChapters([]); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                backgroundColor: stream === s ? '#5B4FE8' : 'var(--surface)',
                color:           stream === s ? '#fff'    : 'var(--text-muted)',
                border:          `1.5px solid ${stream === s ? '#5B4FE8' : 'var(--border)'}`,
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
                backgroundColor: type === opt.val ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                border: `1.5px solid ${type === opt.val ? '#5B4FE8' : 'var(--border)'}`,
              }}
            >
              <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ fontSize: 20, color: type === opt.val ? '#5B4FE8' : 'var(--text-muted)' }}>
                {opt.icon}
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: type === opt.val ? '#5B4FE8' : 'var(--text-primary)' }}>{opt.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
        {type === 'faculty_coaching' && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#B45309', border: '1px solid rgba(245,158,11,0.20)' }}>
            Coaching tests go to admin review before students can access them.
          </p>
        )}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Test Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Chapter 3 Revision Test"
          className="w-full rounded-xl px-4 py-3 text-base"
          style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Subject</label>
        <div className="flex gap-2">
          {subjects.map(s => (
            <button key={s} type="button" onClick={() => setSubject(s)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: subject === s ? '#5B4FE8' : 'var(--surface)',
                color: subject === s ? '#fff' : 'var(--text-muted)',
                border: `1.5px solid ${subject === s ? '#5B4FE8' : 'var(--border)'}`,
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
            Chapters ({chapters.length} selected)
          </label>
          <button type="button" onClick={() => setChapters(chapters.length === allChapters.length ? [] : [...allChapters])} className="btn-ghost btn-sm">
            {chapters.length === allChapters.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        {loadingCh ? (
          <div className="h-24 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--surface)' }} />
        ) : (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
            {allChapters.map(ch => {
              const on = chapters.includes(ch);
              return (
                <button key={ch} type="button" onClick={() => toggleChapter(ch)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={{
                    backgroundColor: on ? '#5B4FE8' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${on ? '#5B4FE8' : 'var(--border)'}`,
                  }}>
                  {ch}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Difficulty + Count */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}>
            {(['Easy', 'Medium', 'Hard', 'Mixed'] as Difficulty[]).map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Questions</label>
          <select value={count} onChange={e => setCount(Number(e.target.value))}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}>
            {[10, 20, 30, 40, 50].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Duration + Dates */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Duration (min)</label>
          <input type="number" value={durationMins} onChange={e => setDurationMins(Number(e.target.value))} min={10} max={180}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Start At</label>
          <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>
        <div className="space-y-2">
          <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>End At</label>
          <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={3}
          placeholder="Any special instructions for students…"
          className="w-full rounded-xl px-4 py-3 text-sm resize-none"
          style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      {/* Negative marking */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={negativeMarking}
          onClick={() => setNeg(p => !p)}
          className="w-10 h-5 rounded-full transition-all relative"
          style={{ backgroundColor: negativeMarking ? '#5B4FE8' : 'var(--border)' }}
        >
          <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform"
            style={{ transform: negativeMarking ? 'translateX(20px)' : 'translateX(0)' }} />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Enable negative marking (−1 per wrong answer)</span>
      </div>

      {/* Browser security mode (Feature 2) */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Browser Security</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { val: 'open',   label: 'Allow Tab Switching', desc: 'Tab switches are logged and the student is flagged — no blocking.', icon: 'tab' },
            { val: 'locked', label: 'Complete Lock Mode',  desc: 'Blocks tab-switch, copy/paste, right-click & dev-tools. Warns and can auto-submit.', icon: 'lock' },
          ] as const).map(opt => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setLockMode(opt.val)}
              className="text-left rounded-2xl p-4 flex gap-3 items-start transition-all"
              style={{
                backgroundColor: lockMode === opt.val ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                border: `1.5px solid ${lockMode === opt.val ? '#5B4FE8' : 'var(--border)'}`,
              }}
            >
              <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ fontSize: 20, color: lockMode === opt.val ? '#5B4FE8' : 'var(--text-muted)' }}>
                {opt.icon}
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: lockMode === opt.val ? '#5B4FE8' : 'var(--text-primary)' }}>{opt.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
        {lockMode === 'locked' && (
          <div className="flex items-center flex-wrap gap-2 mt-1 px-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Auto-submit after</span>
            <select
              value={autoSubmitViolations}
              onChange={e => setAutoSubmit(Number(e.target.value))}
              className="rounded-lg px-2 py-1 text-sm"
              style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {[0, 1, 2, 3, 5].map(n => <option key={n} value={n}>{n === 0 ? 'never' : n}</option>)}
            </select>
            <span>window-leave{autoSubmitViolations === 1 ? '' : 's'}{autoSubmitViolations === 0 ? ' (warnings only)' : ''}.</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary btn-md w-full justify-center"
        style={{ background: submitting ? undefined : 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
      >
        {submitting ? (
          <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
        ) : (
          <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
          {type === 'faculty_coaching' ? 'Submit for Approval' : 'Create & Activate Test'}</>
        )}
      </button>
    </div>
  );
}
