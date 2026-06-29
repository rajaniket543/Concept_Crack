import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import {
  createBattle, joinBattle, startBattle, submitBattleResult,
  subscribeToBattle, type Battle, type BattleParticipant,
} from '../../lib/battles';
import { getChaptersForSubject, getQuestionsForCustomTest, type ExamQuestion } from '../../lib/questions';
import { configureBattle } from '../../lib/battles';
import { useToast } from '../../components/Toast';

type Screen = 'home' | 'lobby' | 'exam' | 'results';
type PaletteState = 'not-visited' | 'answered' | 'not-answered';

const PALETTE_STYLES: Record<PaletteState, { bg: string; color: string }> = {
  'not-visited':  { bg: 'var(--border)',  color: 'var(--text-muted)' },
  'answered':     { bg: '#10B981',        color: '#fff' },
  'not-answered': { bg: '#EF4444',        color: '#fff' },
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function Battle() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const session   = getAuthSession();
  const uid       = session?.user?.id ?? '';
  const name      = session?.user?.name ?? 'Student';
  const stream    = getStudentStream() ?? 'JEE';

  const subjects = stream === 'NEET'
    ? ['Physics', 'Chemistry', 'Biology']
    : ['Physics', 'Chemistry', 'Mathematics'];

  const [screen, setScreen]           = useState<Screen>('home');
  const [battle, setBattle]           = useState<Battle | null>(null);
  const [joinId, setJoinId]           = useState('');
  const [joiningErr, setJoiningErr]   = useState('');
  const [busyCreate, setBusyCreate]   = useState(false);
  const [busyJoin, setBusyJoin]       = useState(false);

  // Host config state
  const [cfgSubject, setCfgSubject]   = useState(subjects[0]);
  const [cfgChapters, setCfgChapters] = useState<string[]>([]);
  const [cfgDifficulty, setCfgDiff]   = useState('Mixed');
  const [cfgCount, setCfgCount]       = useState(20);
  const [allChapters, setAllChapters] = useState<string[]>([]);
  const [loadingCh, setLoadingCh]     = useState(false);
  const [configuring, setConfiguring] = useState(false);

  // Exam state
  const [questions, setQuestions]     = useState<ExamQuestion[]>([]);
  const [current, setCurrent]         = useState(1);
  const [answers, setAnswers]         = useState<Record<number, string>>({});
  const [palette, setPalette]         = useState<Record<number, PaletteState>>({});
  const [seconds, setSeconds]         = useState(0);
  const [submitted, setSubmitted]     = useState(false);
  const timerRef                      = useRef<number | undefined>(undefined);
  const unsubRef                      = useRef<(() => void) | undefined>(undefined);

  useEffect(() => () => {
    if (unsubRef.current) unsubRef.current();
    window.clearInterval(timerRef.current);
  }, []);

  // Live battle subscription
  function subscribeTo(id: string) {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = subscribeToBattle(id, updated => {
      setBattle(updated);
      if (updated.status === 'active' && screen !== 'exam' && !submitted) {
        // Load questions and start exam
        if (updated.questionIds.length > 0 && questions.length === 0) {
          import('../../lib/questions').then(({ getQuestionsByIds }) =>
            getQuestionsByIds(updated.questionIds)
          ).then(qs => {
            setQuestions(qs);
            setSeconds(updated.durationSeconds);
            setPalette(Object.fromEntries(qs.map((_, i) => [i + 1, 'not-visited' as PaletteState])));
            setScreen('exam');
          });
        }
      }
      if (updated.status === 'completed') {
        setScreen('results');
      }
    });
  }

  // Timer
  useEffect(() => {
    if (screen !== 'exam' || submitted) return;
    window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { void handleSubmit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, submitted]);

  async function handleCreate() {
    setBusyCreate(true);
    try {
      const id = await createBattle(uid, name);
      subscribeTo(id);
      const updated = (await import('../../lib/battles')).getBattle;
      setBattle(await updated(id));
      setScreen('lobby');
    } catch {
      toast('Failed to create battle', 'error');
    } finally {
      setBusyCreate(false);
    }
  }

  async function handleJoin() {
    if (!joinId.trim()) { setJoiningErr('Enter a room code'); return; }
    setBusyJoin(true);
    setJoiningErr('');
    try {
      const b = await joinBattle(joinId.trim(), uid, name);
      if (!b) { setJoiningErr('Room not found or battle already started'); setBusyJoin(false); return; }
      subscribeTo(b.id);
      setBattle(b);
      setScreen('lobby');
    } catch {
      setJoiningErr('Failed to join. Check the room code.');
    } finally {
      setBusyJoin(false);
    }
  }

  async function loadChapters(s: string) {
    setLoadingCh(true);
    setCfgSubject(s);
    setCfgChapters([]);
    try {
      const chs = await import('../../lib/questions').then(m => m.getChaptersForSubject(s));
      setAllChapters(chs.map(c => c.chapter));
    } finally {
      setLoadingCh(false);
    }
  }

  async function handleConfigure() {
    if (!battle) return;
    if (cfgChapters.length === 0) { toast('Select at least one chapter', 'error'); return; }
    setConfiguring(true);
    try {
      const { questions: qs, questionIds } = await getQuestionsForCustomTest({
        subject: cfgSubject, chapters: cfgChapters, difficulty: cfgDifficulty, count: cfgCount,
      });
      await configureBattle(battle.id, {
        subjects: [cfgSubject], chapters: cfgChapters, difficulty: cfgDifficulty,
        questionCount: qs.length, durationSeconds: qs.length * 90, questionIds,
      });
      toast('Battle configured! Start when everyone is ready.', 'success');
    } catch {
      toast('Failed to configure. Try again.', 'error');
    } finally {
      setConfiguring(false);
    }
  }

  async function handleStart() {
    if (!battle) return;
    if (!battle.questionIds.length) { toast('Configure the battle first', 'error'); return; }
    try { await startBattle(battle.id); } catch { toast('Failed to start', 'error'); }
  }

  function onSelect(key: string) {
    if (submitted) return;
    setAnswers(p => ({ ...p, [current]: key }));
    setPalette(p => ({ ...p, [current]: 'answered' }));
  }

  async function handleSubmit() {
    if (submitted || !battle) return;
    setSubmitted(true);
    window.clearInterval(timerRef.current);
    let correct = 0, incorrect = 0;
    const q = questions;
    q.forEach((qs, i) => {
      const ans = answers[i + 1];
      if (ans !== undefined) {
        if (qs.answer && ans === qs.answer) correct++;
        else incorrect++;
      }
    });
    const skipped = q.length - correct - incorrect;
    const accuracy = q.length > 0 ? Math.round((correct / q.length) * 100) : 0;
    const score = Math.max(0, correct * 4 - incorrect);
    const timeUsed = battle.durationSeconds - seconds;
    await submitBattleResult(battle.id, uid, {
      answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v])),
      score, correctCount: correct, incorrectCount: incorrect,
      skippedCount: skipped, accuracyPct: accuracy, timeTaken: timeUsed,
    });
    setPalette(p => {
      const next = { ...p };
      q.forEach((_, i) => {
        if (next[i + 1] === 'not-visited') next[i + 1] = 'not-answered';
      });
      return next;
    });
  }

  const isHost = battle?.hostId === uid;
  const participants = battle ? Object.values(battle.participants) : [];
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const q = questions[current - 1];

  // ── Screen: Home ──────────────────────────────────────────────────────────────
  if (screen === 'home') return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Student Battle
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Compete with classmates in a live timed exam
        </p>
      </div>

      <button
        type="button"
        onClick={handleCreate}
        disabled={busyCreate}
        className="w-full rounded-2xl p-5 text-left flex items-center gap-4 transition-all"
        style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', color: '#fff', border: 'none', boxShadow: '0 8px 24px rgba(91,79,232,0.30)' }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>add_circle</span>
        </div>
        <div className="flex-1">
          <div className="font-bold text-base">Create Battle Room</div>
          <div className="text-sm opacity-80">Host a live exam, invite friends</div>
        </div>
        {busyCreate && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="relative text-center">
          <span className="px-4 text-sm" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-faint)' }}>or join with code</span>
        </div>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={joinId}
          onChange={e => { setJoinId(e.target.value); setJoiningErr(''); }}
          placeholder="Enter room code…"
          className="w-full rounded-xl px-4 py-3 text-base font-mono"
          style={{
            backgroundColor: 'var(--surface)', border: `1.5px solid ${joiningErr ? '#EF4444' : 'var(--border)'}`,
            color: 'var(--text-primary)', outline: 'none',
          }}
        />
        {joiningErr && <p className="text-sm" style={{ color: '#EF4444' }}>{joiningErr}</p>}
        <button
          type="button"
          onClick={handleJoin}
          disabled={busyJoin}
          className="btn-outline btn-md w-full justify-center"
        >
          {busyJoin ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
          Join Battle
        </button>
      </div>
    </div>
  );

  // ── Screen: Lobby ──────────────────────────────────────────────────────────────
  if (screen === 'lobby' && battle) return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Battle Lobby
          </h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
            Room: <span className="font-bold" style={{ color: '#5B4FE8' }}>{battle.id}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(battle.id).then(() => toast('Room code copied!', 'success'))}
          className="btn-outline btn-sm"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
          Copy Code
        </button>
      </div>

      {/* Participants */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-label-lg font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Participants ({participants.length})
        </h2>
        <div className="space-y-2">
          {participants.map(p => (
            <div key={p.uid} className="flex items-center gap-3 py-2">
              <div className="avatar avatar-sm">{p.initials}</div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
              {p.uid === battle.hostId && (
                <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8' }}>Host</span>
              )}
              {p.uid === uid && (
                <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }}>You</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Host configuration */}
      {isHost && (
        <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-secondary)' }}>Configure Battle</h2>

          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
            <div className="flex gap-2">
              {subjects.map(s => (
                <button key={s} type="button" onClick={() => { setCfgSubject(s); loadChapters(s); }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: cfgSubject === s ? '#5B4FE8' : 'var(--surface-muted)',
                    color: cfgSubject === s ? '#fff' : 'var(--text-muted)',
                    border: `1.5px solid ${cfgSubject === s ? '#5B4FE8' : 'var(--border)'}`,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loadingCh ? (
            <div className="h-10 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--surface-muted)' }} />
          ) : allChapters.length > 0 && (
            <div>
              <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Chapters ({cfgChapters.length} selected)
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {allChapters.map(ch => {
                  const on = cfgChapters.includes(ch);
                  return (
                    <button key={ch} type="button"
                      onClick={() => setCfgChapters(p => on ? p.filter(x => x !== ch) : [...p, ch])}
                      className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                      style={{
                        backgroundColor: on ? '#5B4FE8' : 'var(--surface-muted)',
                        color: on ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${on ? '#5B4FE8' : 'var(--border)'}`,
                      }}>
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
              <select value={cfgDifficulty} onChange={e => setCfgDiff(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {['Easy', 'Medium', 'Hard', 'Mixed'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Questions</label>
              <select value={cfgCount} onChange={e => setCfgCount(Number(e.target.value))}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {[10, 20, 30, 40].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <button type="button" onClick={handleConfigure} disabled={configuring || cfgChapters.length === 0}
            className="btn-outline btn-md w-full justify-center">
            {configuring ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>}
            {battle.questionIds.length > 0 ? 'Reconfigure' : 'Configure Battle'}
          </button>

          <button type="button" onClick={handleStart} disabled={!battle.questionIds.length}
            className="btn-primary btn-md w-full justify-center"
            style={{ background: battle.questionIds.length ? 'linear-gradient(135deg, #5B4FE8, #7C3AED)' : undefined }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sports_esports</span>
            Start Battle ({participants.length} player{participants.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      {!isHost && (
        <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin block mx-auto mb-3" style={{ borderColor: '#5B4FE8', borderTopColor: 'transparent' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Waiting for host to start…</p>
          {battle.questionIds.length > 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Battle configured · {battle.questionCount} questions ready</p>
          )}
        </div>
      )}
    </div>
  );

  // ── Screen: Exam ──────────────────────────────────────────────────────────────
  if (screen === 'exam' && battle && q) {
    const answered = Object.keys(answers).length;
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)', userSelect: 'none' }}>
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 h-14 z-50"
          style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined" style={{ color: '#5B4FE8' }}>sports_esports</span>
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Battle: {battle.id.slice(0, 8)}…</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold" style={{ color: seconds <= 60 ? '#EF4444' : 'var(--text-primary)' }}>
              {formatTime(seconds)}
            </span>
            <button type="button"
              onClick={() => { if (window.confirm('Submit and end your exam?')) void handleSubmit(); }}
              disabled={submitted}
              className="btn-primary btn-sm"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
              Submit
            </button>
          </div>
        </header>

        <div className="flex pt-14 h-screen overflow-hidden">
          {/* Question */}
          <main className="flex-1 overflow-y-auto px-6 py-8 max-w-3xl mx-auto w-full">
            <div className="text-sm font-semibold mb-5" style={{ color: 'var(--text-muted)' }}>
              Q{current} of {questions.length}
              <span className="ml-3 px-2 py-0.5 rounded-full text-xs" style={{
                backgroundColor: q.difficulty === 'Hard' ? 'rgba(239,68,68,0.10)' : q.difficulty === 'Medium' ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.10)',
                color: q.difficulty === 'Hard' ? '#EF4444' : q.difficulty === 'Medium' ? '#B45309' : '#059669',
              }}>{q.difficulty}</span>
            </div>
            <div className="rounded-xl p-5 mb-5 text-base leading-relaxed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              {q.prompt}
            </div>
            <div className="space-y-3">
              {q.options.map(opt => {
                const sel = answers[current] === opt.key;
                return (
                  <button key={opt.key} type="button" onClick={() => onSelect(opt.key)}
                    disabled={submitted}
                    className="w-full text-left rounded-xl flex items-center gap-3 transition-all"
                    style={{
                      border: `1.5px solid ${sel ? '#5B4FE8' : 'var(--border)'}`,
                      backgroundColor: sel ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                      padding: '12px 16px',
                    }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ backgroundColor: sel ? '#5B4FE8' : 'var(--surface-muted)', color: sel ? '#fff' : 'var(--text-muted)' }}>
                      {opt.key}
                    </div>
                    <span className="text-sm" style={{ color: sel ? '#5B4FE8' : 'var(--text-primary)' }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setCurrent(c => Math.max(1, c - 1))} disabled={current === 1} className="btn-outline btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span> Prev
              </button>
              <button type="button" onClick={() => setCurrent(c => Math.min(questions.length, c + 1))} disabled={current === questions.length} className="btn-primary btn-sm"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                Next <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </main>

          {/* Live leaderboard */}
          <aside className="w-56 shrink-0 flex flex-col overflow-y-auto"
            style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Live</p>
            </div>
            <div className="flex-1 p-3 space-y-2">
              {sorted.map((p, i) => (
                <div key={p.uid} className={`rounded-xl px-3 py-2 flex items-center gap-2 ${p.uid === uid ? 'ring-1 ring-[#5B4FE8]' : ''}`}
                  style={{ backgroundColor: 'var(--surface-muted)' }}>
                  <span className="text-xs font-bold w-4 shrink-0" style={{ color: i === 0 ? '#F59E0B' : 'var(--text-faint)' }}>{i + 1}</span>
                  <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{p.initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                      {p.status === 'completed' ? `${p.score}pts done` : `${Object.keys(p.answers).length}/${battle.questionCount}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {/* Palette */}
            <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="grid grid-cols-5 gap-1">
                {questions.map((_, i) => {
                  const n = i + 1;
                  const s = palette[n] ?? 'not-visited';
                  const st = PALETTE_STYLES[s];
                  return (
                    <button key={n} type="button" onClick={() => setCurrent(n)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: st.bg, color: st.color, outline: n === current ? '2px solid #5B4FE8' : 'none', outlineOffset: 1 }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ── Screen: Results ───────────────────────────────────────────────────────────
  if (screen === 'results' && battle) {
    const me = battle.participants[uid];
    const rank = sorted.findIndex(p => p.uid === uid) + 1;
    return (
      <div className="p-6 max-w-xl mx-auto space-y-6">
        <div className="text-center">
          <span className="text-5xl">{rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎖️'}</span>
          <h1 className="text-display-sm font-bold mt-3" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Battle Over!
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            You finished #{rank} of {participants.length}
          </p>
        </div>

        {me && (
          <div className="rounded-2xl p-5 grid grid-cols-3 gap-4 text-center"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            {[
              { label: 'Score', val: me.score },
              { label: 'Accuracy', val: `${me.accuracyPct}%` },
              { label: 'Correct', val: me.correctCount },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="text-2xl font-bold" style={{ color: '#5B4FE8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{val}</div>
                <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-faint)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
            <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-secondary)' }}>Final Leaderboard</h2>
          </div>
          {sorted.map((p, i) => (
            <div key={p.uid} className={`flex items-center gap-3 px-4 py-3 ${i < sorted.length - 1 ? 'border-b' : ''}`}
              style={{ borderColor: 'var(--border)', backgroundColor: p.uid === uid ? 'rgba(91,79,232,0.04)' : 'var(--surface)' }}>
              <span className="text-sm font-bold w-6 text-center" style={{ color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : 'var(--text-faint)' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{p.initials}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.correctCount}✓ {p.incorrectCount}✗ {p.skippedCount}—</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: i === 0 ? '#F59E0B' : 'var(--text-primary)' }}>{p.score}</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{p.accuracyPct}%</p>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setScreen('home')} className="btn-outline btn-md w-full justify-center">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
          Back to Battle Home
        </button>
      </div>
    );
  }

  return null;
}
