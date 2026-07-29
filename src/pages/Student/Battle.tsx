import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { updateStudentProgress } from '../../lib/db';
import { saveTestAttempt } from '../../lib/tests';
import {
  createBattle, joinBattle, startBattle, submitBattleResult,
  subscribeToBattle, configureBattle, inviteStudentToBattle,
  declineBattleInvite, getPendingBattleInvites, searchStudents, getBattle,
  type Battle, type BattleParticipant, type StudentSearchResult,
} from '../../lib/battles';
import { getQuestionsForCustomTest, type ExamQuestion } from '../../lib/questions';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { pathFor } from '../../lib/pages';
import MathText from '../../components/MathText';
import SelectableChip from '../../components/SelectableChip';

type Screen = 'confirm' | 'home' | 'profile' | 'lobby' | 'exam';
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

// These two lists back only the Create-Battle wizard's cosmetic steps (type &
// team format) — the real backend has no concept of either, so picking a
// value here never changes what gets sent to configureBattle().
const WIZARD_TYPES = ['Fastest Finger', 'Full Test'];
const WIZARD_TEAMS = ['1 vs 1', '2 vs 2', '3 vs 3', 'Free-for-all'];

// Illustrative-only sample rows for the Home screen's "Live Public Battles"
// list — there is no public-battle discovery backend, so nothing here is
// clickable into a real room.
const DEMO_PUBLIC_BATTLES = [
  { title: 'Chemical Bonding Sprint', subject: 'Chemistry', meta: '10 Qs · Hosted by a classmate', icon: 'science', color: '#38BDF8' },
  { title: 'Mechanics Duel', subject: 'Physics', meta: '15 Qs · 1 vs 1', icon: 'bolt', color: '#8B5CF6' },
  { title: 'Coordinate Geometry', subject: 'Mathematics', meta: '12 Qs · Team battle', icon: 'calculate', color: '#10B981' },
];

export default function Battle() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const confirm   = useConfirm();
  const session   = getAuthSession();
  const uid       = session?.user?.id ?? '';
  const name      = session?.user?.name ?? 'Student';
  const stream    = getStudentStream() ?? 'JEE';

  const subjects = stream === 'NEET'
    ? ['Physics', 'Chemistry', 'Biology']
    : ['Physics', 'Chemistry', 'Mathematics'];

  const [screen, setScreen]           = useState<Screen>('confirm');
  const [battle, setBattle]           = useState<Battle | null>(null);
  const [joinId, setJoinId]           = useState('');
  const [joiningErr, setJoiningErr]   = useState('');
  const [busyCreate, setBusyCreate]   = useState(false);
  const [busyJoin, setBusyJoin]       = useState(false);

  // Pending invites on home screen
  const [pendingInvites, setPendingInvites]   = useState<Battle[]>([]);
  const [decliningId,    setDecliningId]      = useState<string | null>(null);
  const [acceptingId,    setAcceptingId]      = useState<string | null>(null);

  // Search/invite state in lobby
  const [searchTerm,     setSearchTerm]       = useState('');
  const [searchResults,  setSearchResults]    = useState<StudentSearchResult[]>([]);
  const [searchLoading,  setSearchLoading]    = useState(false);
  const [invitingUid,    setInvitingUid]      = useState<string | null>(null);
  const searchDebounce                        = useRef<number | undefined>(undefined);

  // Host config state — shared by the lobby's own "Configure Battle" panel
  // and the Create-Battle wizard's real "Configuration" step.
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

  // Join modal (Home screen)
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Create-Battle wizard (Home screen)
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizStep, setWizStep]             = useState(1);
  const [wizType, setWizType]             = useState(WIZARD_TYPES[0]);
  const [wizTeam, setWizTeam]             = useState(WIZARD_TEAMS[0]);
  const [wizVisibility, setWizVisibility] = useState<'Public' | 'Private'>('Public');
  const [wizCreatedId, setWizCreatedId]   = useState<string | null>(null);
  const [wizBusy, setWizBusy]             = useState(false);

  // Player-profile drawer (Lobby / Live leaderboard)
  const [drawerParticipant, setDrawerParticipant] = useState<BattleParticipant | null>(null);

  useEffect(() => () => {
    if (unsubRef.current) unsubRef.current();
    window.clearInterval(timerRef.current);
  }, []);

  // Safety net: if battle completes (all submitted) and this player hasn't submitted yet
  // (e.g. timer race), force-submit them so they reach the results/chatbot page.
  useEffect(() => {
    if (!battle || submitted || screen !== 'exam') return;
    const parts   = Object.values(battle.participants);
    const allDone = parts.length > 0 && parts.every(p => p.status === 'completed');
    if (battle.status === 'completed' || allDone) void handleSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle]);

  // Load pending battle invites when on home screen
  useEffect(() => {
    if (screen !== 'home' || !uid) return;
    getPendingBattleInvites(uid).then(setPendingInvites).catch(() => undefined);
  }, [screen, uid]);

  // Debounced student search
  useEffect(() => {
    window.clearTimeout(searchDebounce.current);
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    searchDebounce.current = window.setTimeout(async () => {
      setSearchLoading(true);
      const res = await searchStudents(searchTerm);
      setSearchResults(res.filter(r => r.uid !== uid));
      setSearchLoading(false);
    }, 400);
    return () => window.clearTimeout(searchDebounce.current);
  }, [searchTerm, uid]);

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
      if (updated.status === 'completed' && !submitted) {
        void handleSubmit();
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

  async function handleAcceptInvite(battleId: string) {
    setAcceptingId(battleId);
    try {
      const b = await joinBattle(battleId, uid, name);
      if (!b) { toast('Battle no longer available', 'error'); return; }
      subscribeTo(battleId);
      setBattle(b);
      setScreen('lobby');
    } catch {
      toast('Failed to join battle', 'error');
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleDeclineInvite(battleId: string) {
    setDecliningId(battleId);
    await declineBattleInvite(battleId, uid).catch(() => undefined);
    setPendingInvites(p => p.filter(b => b.id !== battleId));
    setDecliningId(null);
  }

  async function handleInviteStudent(inviteUid: string) {
    if (!battle) return;
    setInvitingUid(inviteUid);
    try {
      await inviteStudentToBattle(battle.id, inviteUid);
      toast('Invite sent! They will see it on their Battle page.', 'success');
      setSearchTerm('');
      setSearchResults([]);
    } catch {
      toast('Failed to send invite', 'error');
    } finally {
      setInvitingUid(null);
    }
  }

  async function handleCreate() {
    setBusyCreate(true);
    try {
      const id = await createBattle(uid, name);
      subscribeTo(id);
      setBattle(await getBattle(id));
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
      setShowJoinModal(false);
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

  // Shared by the lobby's "Configure Battle" panel and the wizard's final
  // step — both just call this with the real battle id.
  async function doConfigure(battleId: string): Promise<boolean> {
    if (cfgChapters.length === 0) { toast('Select at least one chapter', 'error'); return false; }
    setConfiguring(true);
    try {
      const { questions: qs, questionIds } = await getQuestionsForCustomTest({
        subject: cfgSubject, chapters: cfgChapters, difficulty: cfgDifficulty, count: cfgCount,
      });
      await configureBattle(battleId, {
        subjects: [cfgSubject], chapters: cfgChapters, difficulty: cfgDifficulty,
        questionCount: qs.length, durationSeconds: qs.length * 90, questionIds,
      });
      return true;
    } catch {
      toast('Failed to configure. Try again.', 'error');
      return false;
    } finally {
      setConfiguring(false);
    }
  }

  async function handleConfigure() {
    if (!battle) return;
    const ok = await doConfigure(battle.id);
    if (ok) toast('Battle configured! Start when everyone is ready.', 'success');
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

    let correct = 0, incorrect = 0, unscored = 0;
    const chapterStats: Record<string, { subject: string; chapter: string; correct: number; total: number }> = {};
    questions.forEach((qs, i) => {
      const ans     = answers[i + 1];
      const subj    = qs.subject  || battle.subjects[0] || 'Unknown';
      const chap    = qs.chapter  || qs.section         || 'Unknown';
      const key     = `${subj}::${chap}`;

      // A question with no correct answer on record can't be graded — never
      // score a response against it (previously this silently marked every
      // answer, including the correct one, as wrong).
      if (!qs.answer) { unscored++; return; }

      if (!chapterStats[key]) chapterStats[key] = { subject: subj, chapter: chap, correct: 0, total: 0 };
      chapterStats[key].total++;
      if (ans !== undefined) {
        if (ans === qs.answer) { correct++; chapterStats[key].correct++; }
        else incorrect++;
      }
    });

    if (unscored > 0) {
      toast(`${unscored} question${unscored === 1 ? '' : 's'} in this battle could not be graded (missing answer key) and were excluded from scoring.`, 'info');
    }

    const skipped    = questions.length - correct - incorrect;
    const accuracy   = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const score      = Math.max(0, correct * 4 - incorrect);
    const timeUsed   = battle.durationSeconds - seconds;
    const topicAccuracy = Object.values(chapterStats).map(s => ({
      topic: s.chapter, subject: s.subject,
      pct:   s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      correct: s.correct, total: s.total,
    }));

    await submitBattleResult(battle.id, uid, {
      answers:  Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v])),
      score, correctCount: correct, incorrectCount: incorrect,
      skippedCount: skipped, accuracyPct: accuracy, timeTaken: timeUsed,
    });

    // Build leaderboard with my updated score merged in
    const myEntry = {
      uid, name,
      initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      status: 'completed' as const,
      score, correctCount: correct, incorrectCount: incorrect,
      skippedCount: skipped, accuracyPct: accuracy, timeTaken: timeUsed, answers: {},
    };
    const allParticipants = Object.values(battle.participants).map(p =>
      p.uid === uid ? myEntry : p
    );
    const leaderboard = [...allParticipants].sort((a, b) => b.score - a.score);
    const myRank = leaderboard.findIndex(p => p.uid === uid) + 1;
    const examTitle = `Battle — ${battle.subjects.join(' / ') || 'Mixed'}`;

    // Log the battle as an attempt so it appears in Review Tests, categorised as
    // "Battle". Must never block reaching the results screen — retry once, and
    // if it still fails, let the student through with a visible warning instead
    // of silently losing the attempt.
    const battleAttemptPayload = {
      testId:       `battle:${battle.id}`,
      studentId:    uid,
      answers:      Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v as 'A'|'B'|'C'|'D'])),
      score, correctCount: correct, incorrectCount: incorrect,
      skippedCount: skipped, accuracyPct: accuracy, timeSeconds: timeUsed,
      status:       'submitted' as const,
      startedAt:    new Date().toISOString(),
      submittedAt:  new Date().toISOString(),
      testType:     'battle' as const,
      testTitle:    examTitle,
      subjects:     battle.subjects.length ? battle.subjects : ['Mixed'],
      questionIds:  questions.map(q => q.id),
      rank:         myRank,
    };

    try {
      await saveTestAttempt(battleAttemptPayload);
    } catch {
      await new Promise(r => setTimeout(r, 800));
      try {
        await saveTestAttempt(battleAttemptPayload);
      } catch (e) {
        console.error('saveTestAttempt failed after retry', e);
        toast('Your result is shown below, but this battle could not be saved to Review Tests. Please check your connection.', 'error');
      }
    }

    // Never throws internally (see updateStudentProgress) — safe to await.
    await updateStudentProgress(uid, {
      lastActivity: { type: 'test', title: examTitle, score: accuracy, accuracy, completedAt: new Date().toISOString() },
      completedTests: 1,
      latestTestResult: {
        testTitle: examTitle,
        testDate:  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        subject:   battle.subjects[0] ?? 'Mixed',
        chapter:   battle.chapters[0] ?? '',
        subjects:  battle.subjects.length ? battle.subjects : ['Mixed'],
        chapters:  battle.chapters,
        totalQuestions: questions.length,
        correctCount: correct, incorrectCount: incorrect, skippedCount: skipped,
        accuracyPct: accuracy, score,
        timeMinutes: Math.max(1, Math.round(timeUsed / 60)),
        easyPct:   0, mediumPct: 0, hardPct: 0,
        topicAccuracy,
      },
    });

    // Navigate to the same animated result + AI tutor page as regular tests
    navigate(pathFor('chatbot'), {
      state: {
        score, correctCount: correct, incorrectCount: incorrect,
        skippedCount: skipped, accuracyPct: accuracy,
        examTitle,
        subjects:       battle.subjects.length ? battle.subjects : ['Mixed'],
        chapters:       battle.chapters,
        topicAccuracy,
        totalQuestions: questions.length,
        isBattle:       true,
        battleRank:     myRank,
        battleParticipants: leaderboard,
      },
    });
  }

  // ---------- Create-Battle wizard (Home screen) ----------
  function openCreateWizard() {
    setWizStep(1);
    setWizCreatedId(null);
    setWizType(WIZARD_TYPES[0]);
    setWizTeam(WIZARD_TEAMS[0]);
    setWizVisibility('Public');
    if (allChapters.length === 0) void loadChapters(cfgSubject);
    setShowCreateWizard(true);
  }

  async function handleWizardCreate() {
    if (cfgChapters.length === 0) { toast('Select at least one chapter', 'error'); return; }
    setWizBusy(true);
    try {
      const id = await createBattle(uid, name);
      subscribeTo(id);
      setBattle(await getBattle(id));
      const ok = await doConfigure(id);
      if (ok) setWizCreatedId(id);
    } catch {
      toast('Failed to create battle', 'error');
    } finally {
      setWizBusy(false);
    }
  }

  const isHost = battle?.hostId === uid;
  const participants = battle ? Object.values(battle.participants) : [];
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const q = questions[current - 1];
  const timerPct = battle && battle.durationSeconds > 0 ? seconds / battle.durationSeconds : 0;

  // ── Screen: Confirm ─────────────────────────────────────────────────────────
  // Shown once, before the full-screen Arena takes over — lets a student back
  // out to the dashboard instead of landing straight in the arena chrome.
  if (screen === 'confirm') return (
    <div className="arena-theme">
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(4,3,8,0.55)', backdropFilter: 'blur(3px)' }}
        onClick={() => navigate(pathFor('student'))}
      />
      <div
        className="fixed top-0 right-0 h-screen z-50 flex flex-col"
        style={{
          width: 360, maxWidth: '90vw', background: 'var(--arena-surface)',
          borderLeft: '1px solid var(--arena-border)', padding: '30px 26px',
          boxShadow: '-24px 0 60px rgba(0,0,0,0.45)', animation: 'arenaSlideIn .32s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'conic-gradient(from 200deg, var(--arena-gold), #8B5CF6, var(--arena-crimson), var(--arena-gold))', boxShadow: '0 0 24px rgba(232,178,77,0.3)' }}
        >
          <span className="material-symbols-outlined" style={{ color: '#0c0b12', fontSize: 22 }}>bolt</span>
        </div>
        <h2 className="text-xl font-bold mb-1.5" style={{ color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Enter Battle Mode?</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          You're about to leave your dashboard for the Battle Arena — live head-to-head exams against classmates.
        </p>
        <div className="flex flex-col gap-3 mb-auto">
          {[
            { icon: 'flash_on', text: 'Join or create a battle in seconds' },
            { icon: 'groups', text: 'Compete live against classmates in a timed exam' },
            { icon: 'school', text: 'Your academic progress stays untouched' },
          ].map(pt => (
            <div key={pt.text} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--arena-gold)', fontSize: 18 }}>{pt.icon}</span>
              {pt.text}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 mt-8">
          <button
            type="button" onClick={() => setScreen('home')}
            className="btn-primary btn-md w-full justify-center"
            style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none' }}
          >
            Enter Battle Mode
          </button>
          <button type="button" onClick={() => navigate(pathFor('student'))} className="btn-outline btn-md w-full justify-center">
            Cancel
          </button>
        </div>
      </div>
      <style>{`@keyframes arenaSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );

  // ── Everything below lives inside the full-screen Arena shell ──────────────
  return (
    <div className="arena-theme fixed inset-0 z-40 overflow-y-auto" style={{ background: 'var(--arena-bg)', color: '#fff' }}>
      {/* Arena topbar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 sm:px-7 py-3"
        style={{ background: 'rgba(7,6,13,0.72)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--arena-border)' }}
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-lg shrink-0"
            style={{ background: 'conic-gradient(from 200deg, var(--arena-gold), #8B5CF6, var(--arena-crimson), var(--arena-gold))', boxShadow: '0 0 16px rgba(232,178,77,0.3)' }}
          />
          <div className="hidden sm:block">
            <div className="text-sm font-bold leading-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Battle Arena</div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--arena-gold)' }}>Concept Crack</div>
          </div>
        </div>

        {screen === 'exam' ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold" style={{ color: seconds <= 60 ? 'var(--arena-crimson)' : '#fff' }}>
              {formatTime(seconds)}
            </span>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Submit and end your battle?',
                  message: 'Your answers will be locked in and scored against your opponents. This cannot be undone.',
                  confirmLabel: 'Submit',
                  tone: 'warning',
                  icon: 'send',
                });
                if (ok) void handleSubmit();
              }}
              disabled={submitted}
              className="btn-primary btn-sm"
              style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none' }}
            >
              Submit
            </button>
          </div>
        ) : (
          <>
            <div className="hidden sm:flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
              {(['home', 'profile'] as const).map(tab => (
                <button
                  key={tab} type="button" onClick={() => setScreen(tab)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                  style={screen === tab
                    ? { background: 'linear-gradient(135deg, rgba(232,178,77,0.18), rgba(139,92,246,0.22))', color: '#fff', boxShadow: 'inset 0 0 0 1px rgba(232,178,77,0.3)' }
                    : { color: 'var(--text-muted)' }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span
                className="hidden md:flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full"
                style={{ color: 'var(--text-muted)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444' }} /> Live now
              </span>
              <button
                type="button" onClick={() => navigate(pathFor('student'))}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--arena-border)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                <span className="hidden sm:inline">Exit Arena</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-7 py-6">

        {/* ── Home ─────────────────────────────────────────────────────────── */}
        {screen === 'home' && (
          <div className="space-y-6" style={{ animation: 'arenaFade .35s ease' }}>

            <div
              className="rounded-2xl p-6 sm:p-7 flex items-center justify-between gap-5 flex-wrap"
              style={{ background: 'linear-gradient(120deg, rgba(232,178,77,0.14), rgba(139,92,246,0.16) 50%, rgba(37,99,235,0.12))', border: '1px solid rgba(232,178,77,0.22)' }}
            >
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--arena-gold)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span> Battle Arena
                </div>
                <div className="text-2xl font-bold mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Ready to battle, {name.split(' ')[0]}?
                </div>
                <div className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
                  Create a room and invite classmates, or drop in with a code to join one already in progress.
                </div>
              </div>
              <button
                type="button" onClick={handleCreate} disabled={busyCreate}
                className="btn-primary btn-md"
                style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none', boxShadow: '0 8px 24px rgba(232,178,77,0.28)' }}
              >
                {busyCreate
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bolt</span>}
                Quick Battle
              </button>
            </div>

            {pendingInvites.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                  Pending Invites ({pendingInvites.length})
                </h2>
                {pendingInvites.map(b => (
                  <div key={b.id} className="rounded-2xl p-4 flex items-center gap-4"
                    style={{ backgroundColor: 'var(--arena-surface)', border: '1.5px solid rgba(232,178,77,0.20)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--arena-gold)', fontSize: 24 }}>sports_esports</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Battle invite</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Room: {b.id.slice(0, 8)}… · {Object.keys(b.participants).length} player{Object.keys(b.participants).length !== 1 ? 's' : ''} waiting
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleDeclineInvite(b.id)} disabled={decliningId === b.id}
                        className="btn-ghost btn-sm" style={{ color: 'var(--arena-crimson)' }}>
                        Decline
                      </button>
                      <button type="button" onClick={() => handleAcceptInvite(b.id)} disabled={acceptingId === b.id}
                        className="btn-sm"
                        style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none', borderRadius: 10 }}>
                        {acceptingId === b.id
                          ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                          : 'Accept'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button" onClick={() => setShowJoinModal(true)}
                className="text-left rounded-2xl p-6 transition-transform hover:-translate-y-0.5"
                style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(56,189,248,0.14)', color: '#38BDF8' }}>
                  <span className="material-symbols-outlined">login</span>
                </div>
                <div className="font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Join a Battle</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Have a room code from a friend or your batch? Drop it in and jump straight into the lobby.
                </div>
                <div className="text-xs font-bold mt-3 flex items-center gap-1" style={{ color: '#38BDF8' }}>
                  Enter a code <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                </div>
              </button>
              <button
                type="button" onClick={openCreateWizard}
                className="text-left rounded-2xl p-6 transition-transform hover:-translate-y-0.5"
                style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(232,178,77,0.14)', color: 'var(--arena-gold)' }}>
                  <span className="material-symbols-outlined">add_circle</span>
                </div>
                <div className="font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Create a Battle</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Set the subject, difficulty and question count, then invite whoever you want.
                </div>
                <div className="text-xs font-bold mt-3 flex items-center gap-1" style={{ color: 'var(--arena-gold)' }}>
                  Start setup <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                </div>
              </button>
            </div>

            <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
              <div className="space-y-5">
                <div>
                  <h2 className="text-sm font-bold mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Live Public Battles</h2>
                  <div className="space-y-2.5">
                    {DEMO_PUBLIC_BATTLES.map(b => (
                      <div key={b.title} className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${b.color}24`, color: b.color }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{b.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{b.title}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.subject} · {b.meta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>Illustrative — public battle discovery isn't available yet. Use a room code or Quick Battle to play a real match.</p>
                </div>

                <div
                  className="rounded-2xl p-5 flex items-center gap-4"
                  style={{ background: 'linear-gradient(120deg, rgba(139,92,246,0.16), rgba(232,178,77,0.10))', border: '1px solid rgba(139,92,246,0.25)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(232,178,77,0.14)', color: 'var(--arena-gold)' }}>
                    <span className="material-symbols-outlined">emoji_events</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold">Weekly Tournaments</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Coming soon</div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-bold"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}
                  >
                    {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="font-bold text-sm">{name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stream} Student</div>
                  <div className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                    Ratings, leagues and badges aren't tracked yet — every battle here is a real live exam against real classmates.
                  </div>
                  <button type="button" onClick={() => setScreen('profile')} className="btn-outline btn-sm w-full justify-center mt-4">
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Profile ──────────────────────────────────────────────────────── */}
        {screen === 'profile' && (
          <div className="space-y-6 max-w-2xl mx-auto" style={{ animation: 'arenaFade .35s ease' }}>
            <div className="rounded-2xl p-7 flex items-center gap-5 flex-wrap" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
                {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{name}</div>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'var(--arena-surface2)', color: 'var(--text-muted)', border: '1px solid var(--arena-border)' }}>{stream}</span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>● Online</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-5 flex items-start gap-3" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
              <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--arena-gold)', fontSize: 20 }}>info</span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Battle ratings, win streaks and badges aren't tracked yet, so there's nothing fake to show here — every battle you play is a real, scored live exam. Your results are saved to <strong style={{ color: 'var(--text-primary)' }}>Review Tests</strong> just like any other test.
              </p>
            </div>

            <button type="button" onClick={() => setScreen('home')} className="btn-outline btn-md">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Back to Home
            </button>
          </div>
        )}

        {/* ── Lobby ────────────────────────────────────────────────────────── */}
        {screen === 'lobby' && battle && (
          <div className="max-w-3xl mx-auto space-y-6" style={{ animation: 'arenaFade .35s ease' }}>
            <div className="text-center">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Battle Lobby</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Waiting for everyone to be ready</p>
            </div>

            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(battle.id).then(() => toast('Room code copied!', 'success'))}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-2"
                style={{ background: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: 'var(--text-muted)' }}
              >
                Code: <b style={{ color: 'var(--arena-gold)' }}>{battle.id}</b>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
              </button>
              {battle.questionIds.length > 0 ? (
                <>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: 'var(--text-muted)' }}>
                    Subject: <b style={{ color: '#fff' }}>{battle.subjects.join(', ') || cfgSubject}</b>
                  </span>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: 'var(--text-muted)' }}>
                    Difficulty: <b style={{ color: '#fff' }}>{battle.difficulty || cfgDifficulty}</b>
                  </span>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: 'var(--text-muted)' }}>
                    Questions: <b style={{ color: '#fff' }}>{battle.questionCount}</b>
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: 'var(--text-muted)' }}>
                  Not configured yet
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {participants.map(p => (
                <div
                  key={p.uid} onClick={() => p.uid !== uid && setDrawerParticipant(p)}
                  className="relative rounded-2xl p-4 text-center"
                  style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)', cursor: p.uid !== uid ? 'pointer' : 'default' }}
                >
                  {p.uid === battle.hostId && (
                    <span className="absolute top-2 left-2 text-[8px] font-extrabold px-1.5 py-0.5 rounded" style={{ color: 'var(--arena-gold)', background: 'rgba(232,178,77,0.14)' }}>HOST</span>
                  )}
                  <div className="w-11 h-11 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
                    {p.initials}
                  </div>
                  <div className="text-xs font-bold truncate">{p.name}{p.uid === uid ? ' (You)' : ''}</div>
                  <div className="text-[10px] font-semibold mt-1" style={{ color: '#22C55E' }}>Joined</div>
                </div>
              ))}
            </div>

            {isHost && (
              <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Invite Students</h2>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)', fontSize: 18 }}>search</span>
                  <input
                    type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
                    style={{ backgroundColor: 'var(--arena-surface2)', border: '1.5px solid var(--arena-border)', color: '#fff', outline: 'none' }}
                  />
                  {searchLoading && (
                    <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ borderColor: 'var(--arena-gold)', borderTopColor: 'transparent' }} />
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--arena-border)' }}>
                    {searchResults.map((r, i) => (
                      <div key={r.uid} className={`flex items-center gap-3 px-3 py-2.5 ${i < searchResults.length - 1 ? 'border-b' : ''}`}
                        style={{ borderColor: 'var(--arena-border)', backgroundColor: 'var(--arena-surface)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
                          {(r.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{r.name || 'Student'}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.email}</p>
                        </div>
                        {participants.some(p => p.uid === r.uid) ? (
                          <span className="text-xs font-medium" style={{ color: '#22C55E' }}>In lobby</span>
                        ) : (
                          <button type="button" onClick={() => handleInviteStudent(r.uid)} disabled={invitingUid === r.uid}
                            className="text-xs font-bold px-3 py-1 rounded-lg"
                            style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none' }}>
                            {invitingUid === r.uid
                              ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                              : 'Invite'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {searchTerm.trim() && !searchLoading && searchResults.length === 0 && (
                  <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>No students found for "{searchTerm}"</p>
                )}
              </div>
            )}

            {isHost && (
              <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Configure Battle</h2>

                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
                  <div className="flex gap-2">
                    {subjects.map(s => (
                      <SelectableChip key={s} label={s} selected={cfgSubject === s} onClick={() => { setCfgSubject(s); loadChapters(s); }} color="var(--arena-gold)" fullWidth className="flex-1" />
                    ))}
                  </div>
                </div>

                {loadingCh ? (
                  <div className="h-10 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--arena-surface2)' }} />
                ) : allChapters.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Chapters ({cfgChapters.length} selected)</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {allChapters.map(ch => {
                        const on = cfgChapters.includes(ch);
                        return (
                          <SelectableChip key={ch} variant="pill" size="sm" label={ch} selected={on} color="var(--arena-gold)"
                            onClick={() => setCfgChapters(p => on ? p.filter(x => x !== ch) : [...p, ch])} className="!rounded-full" />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
                    <select value={cfgDifficulty} onChange={e => setCfgDiff(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: '#fff' }}>
                      {['Easy', 'Medium', 'Hard', 'Mixed'].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Questions</label>
                    <select value={cfgCount} onChange={e => setCfgCount(Number(e.target.value))}
                      className="w-full rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: '#fff' }}>
                      {[10, 20, 30, 40].map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <button type="button" onClick={handleConfigure} disabled={configuring || cfgChapters.length === 0} className="btn-outline btn-md w-full justify-center">
                  {configuring ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>}
                  {battle.questionIds.length > 0 ? 'Reconfigure' : 'Configure Battle'}
                </button>

                <div className="flex gap-3">
                  <button type="button" onClick={handleStart} disabled={!battle.questionIds.length}
                    className="btn-primary btn-md flex-1 justify-center"
                    style={{ background: battle.questionIds.length ? 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))' : undefined, color: battle.questionIds.length ? '#1a1206' : undefined, border: 'none' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sports_esports</span>
                    Start Battle ({participants.length})
                  </button>
                  <button type="button" onClick={() => setScreen('home')} className="btn-outline btn-md">Cancel</button>
                </div>
              </div>
            )}

            {!isHost && (
              <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                <span className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin block mx-auto mb-3" style={{ borderColor: 'var(--arena-gold)', borderTopColor: 'transparent' }} />
                <p className="text-sm font-semibold">Waiting for host to start…</p>
                {battle.questionIds.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Battle configured · {battle.questionCount} questions ready</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Live exam ────────────────────────────────────────────────────── */}
        {screen === 'exam' && battle && q && (
          <div style={{ userSelect: 'none', animation: 'arenaFade .35s ease' }}>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div className="text-center">
                <div className="text-lg font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{current} / {questions.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Question</div>
              </div>
              <div className="relative" style={{ width: 56, height: 56 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle cx="28" cy="28" r="24" fill="none" stroke={seconds <= 60 ? 'var(--arena-crimson)' : 'var(--arena-gold)'} strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={150.8} strokeDashoffset={150.8 * (1 - timerPct)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono">{formatTime(seconds)}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{Object.keys(answers).length} / {questions.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Answered</div>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_260px] gap-5 items-start">
              <div className="rounded-2xl p-6" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--arena-gold)' }}>{q.subject || battle.subjects[0]}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                    backgroundColor: q.difficulty === 'Hard' ? 'rgba(239,68,68,0.14)' : q.difficulty === 'Medium' ? 'rgba(245,158,11,0.14)' : 'rgba(34,197,94,0.14)',
                    color: q.difficulty === 'Hard' ? '#EF4444' : q.difficulty === 'Medium' ? '#F59E0B' : '#22C55E',
                  }}>{q.difficulty}</span>
                </div>
                <div className="text-base leading-relaxed mb-6">
                  {q.imageUrl && <img src={q.imageUrl} alt="Question figure" className="rounded-lg max-h-72 mb-4 mx-auto" />}
                  <MathText text={q.prompt} />
                </div>
                <div className="space-y-2.5">
                  {q.options.map(opt => {
                    const sel = answers[current] === opt.key;
                    return (
                      <button key={opt.key} type="button" onClick={() => onSelect(opt.key)} disabled={submitted}
                        className="w-full text-left rounded-xl flex items-center gap-3 transition-all"
                        style={{
                          border: `1.5px solid ${sel ? 'var(--arena-gold)' : 'var(--arena-border)'}`,
                          backgroundColor: sel ? 'rgba(232,178,77,0.08)' : 'var(--arena-surface2)',
                          padding: '13px 16px',
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ backgroundColor: sel ? 'var(--arena-gold)' : 'var(--arena-bg2)', color: sel ? '#1a1206' : 'var(--text-muted)' }}>
                          {opt.key}
                        </div>
                        <span className="text-sm" style={{ color: sel ? '#fff' : 'var(--text-secondary)' }}><MathText text={opt.text} /></span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-6">
                  <button type="button" onClick={() => setCurrent(c => Math.max(1, c - 1))} disabled={current === 1} className="btn-outline btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span> Prev
                  </button>
                  <button type="button" onClick={() => setCurrent(c => Math.min(questions.length, c + 1))} disabled={current === questions.length}
                    className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none' }}>
                    Next <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl p-4" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>Live Leaderboard</p>
                  <div className="space-y-1.5">
                    {sorted.map((p, i) => (
                      <div key={p.uid} onClick={() => p.uid !== uid && setDrawerParticipant(p)}
                        className="rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{ backgroundColor: p.uid === uid ? 'rgba(232,178,77,0.10)' : 'var(--arena-surface2)', cursor: p.uid !== uid ? 'pointer' : 'default' }}>
                        <span className="text-xs font-bold w-4 shrink-0" style={{ color: i === 0 ? 'var(--arena-gold)' : 'var(--text-faint)' }}>{i + 1}</span>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>{p.initials}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{p.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                            {p.status === 'completed' ? `${p.score}pts done` : `${Object.keys(p.answers).length}/${battle.questionCount}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-4" style={{ background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>Palette</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {questions.map((_, i) => {
                      const n = i + 1;
                      const s = palette[n] ?? 'not-visited';
                      const st = PALETTE_STYLES[s];
                      return (
                        <button key={n} type="button" onClick={() => setCurrent(n)}
                          className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: st.bg, color: st.color, outline: n === current ? '2px solid var(--arena-gold)' : 'none', outlineOffset: 1 }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Join modal ───────────────────────────────────────────────────── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-6" style={{ background: 'rgba(4,3,8,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowJoinModal(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full rounded-2xl p-6" style={{ maxWidth: 420, background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Join a Battle</h3>
              <button type="button" onClick={() => setShowJoinModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--arena-surface2)', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Enter the room code shared with you to jump into the lobby.</p>
            <input
              type="text" value={joinId} onChange={e => { setJoinId(e.target.value); setJoiningErr(''); }}
              placeholder="e.g. 7QK3F9" className="w-full rounded-xl px-4 py-3 text-base font-mono mb-2 uppercase"
              style={{ backgroundColor: 'var(--arena-surface2)', border: `1.5px solid ${joiningErr ? 'var(--arena-crimson)' : 'var(--arena-border)'}`, color: '#fff', outline: 'none', letterSpacing: 2 }}
            />
            {joiningErr && <p className="text-xs mb-3" style={{ color: 'var(--arena-crimson)' }}>{joiningErr}</p>}
            <button type="button" onClick={() => void handleJoin()} disabled={busyJoin} className="btn-primary btn-md w-full justify-center"
              style={{ background: 'linear-gradient(135deg, #38BDF8, var(--brand))', border: 'none' }}>
              {busyJoin ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              Join Battle
            </button>
          </div>
        </div>
      )}

      {/* ── Create-Battle wizard ─────────────────────────────────────────── */}
      {showCreateWizard && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-6" style={{ background: 'rgba(4,3,8,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowCreateWizard(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full rounded-2xl p-6" style={{ maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', background: 'var(--arena-surface)', border: '1px solid var(--arena-border)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Create a Battle</h3>
              <button type="button" onClick={() => setShowCreateWizard(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--arena-surface2)', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Step {wizStep} of 5</p>

            {/* Step dots */}
            <div className="flex items-center gap-1.5 mb-6">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="flex-1 h-1 rounded-full" style={{ background: n <= wizStep ? 'linear-gradient(90deg, var(--arena-gold), var(--arena-crimson))' : 'var(--arena-border)' }} />
              ))}
            </div>

            {wizStep === 1 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {WIZARD_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setWizType(t)} className="text-left rounded-xl p-4"
                    style={{ background: 'var(--arena-surface2)', border: `1.5px solid ${wizType === t ? 'var(--arena-gold)' : 'var(--arena-border)'}` }}>
                    <div className="font-bold text-sm mb-1">{t}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t === 'Fastest Finger' ? 'Quick-fire questions, everyone answers at once.' : 'A full competitive test, exactly like a real exam.'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {wizStep === 2 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {(['Public', 'Private'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setWizVisibility(v)} className="text-left rounded-xl p-4"
                    style={{ background: 'var(--arena-surface2)', border: `1.5px solid ${wizVisibility === v ? 'var(--arena-gold)' : 'var(--arena-border)'}` }}>
                    <div className="font-bold text-sm mb-1">{v}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {v === 'Public' ? 'Anyone with the code can join while slots remain.' : 'Only students you invite can join.'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {wizStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
                  <div className="flex gap-2">
                    {subjects.map(s => (
                      <SelectableChip key={s} label={s} selected={cfgSubject === s} onClick={() => loadChapters(s)} color="var(--arena-gold)" fullWidth className="flex-1" />
                    ))}
                  </div>
                </div>
                {loadingCh ? (
                  <div className="h-10 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--arena-surface2)' }} />
                ) : (
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Chapters ({cfgChapters.length} selected)</label>
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                      {allChapters.map(ch => {
                        const on = cfgChapters.includes(ch);
                        return (
                          <SelectableChip key={ch} variant="pill" size="sm" label={ch} selected={on} color="var(--arena-gold)"
                            onClick={() => setCfgChapters(p => on ? p.filter(x => x !== ch) : [...p, ch])} className="!rounded-full" />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
                    <select value={cfgDifficulty} onChange={e => setCfgDiff(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: '#fff' }}>
                      {['Easy', 'Medium', 'Hard', 'Mixed'].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Questions</label>
                    <select value={cfgCount} onChange={e => setCfgCount(Number(e.target.value))} className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--arena-surface2)', border: '1px solid var(--arena-border)', color: '#fff' }}>
                      {[10, 20, 30, 40].map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {wizStep === 4 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {WIZARD_TEAMS.map(t => (
                  <button key={t} type="button" onClick={() => setWizTeam(t)} className="text-center rounded-xl p-3.5"
                    style={{ background: 'var(--arena-surface2)', border: `1.5px solid ${wizTeam === t ? 'var(--arena-gold)' : 'var(--arena-border)'}` }}>
                    <div className="text-xs font-bold">{t}</div>
                  </button>
                ))}
              </div>
            )}

            {wizStep === 5 && !wizCreatedId && (
              <div>
                <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--arena-surface2)', border: '1px solid var(--arena-border)' }}>
                  {[
                    ['Battle Type', wizType], ['Visibility', wizVisibility], ['Subject', cfgSubject],
                    ['Chapters', `${cfgChapters.length} selected`], ['Difficulty', cfgDifficulty],
                    ['Questions', String(cfgCount)], ['Team Format', wizTeam],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-2 text-xs" style={{ borderBottom: '1px solid var(--arena-border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => void handleWizardCreate()} disabled={wizBusy || cfgChapters.length === 0}
                  className="btn-primary btn-md w-full justify-center" style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none' }}>
                  {wizBusy ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
                  Create Battle
                </button>
              </div>
            )}

            {wizStep === 5 && wizCreatedId && (
              <div className="text-center py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>Your Battle Code</p>
                <p className="text-3xl font-bold mb-5 font-mono" style={{ color: 'var(--arena-gold)', letterSpacing: 4 }}>{wizCreatedId}</p>
                <button type="button"
                  onClick={() => navigator.clipboard.writeText(wizCreatedId).then(() => toast('Room code copied!', 'success'))}
                  className="btn-outline btn-sm mb-5">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span> Copy Code
                </button>
                <button type="button" onClick={() => { setShowCreateWizard(false); setScreen('lobby'); }}
                  className="btn-primary btn-md w-full justify-center" style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none' }}>
                  Continue to Lobby
                </button>
              </div>
            )}

            {!(wizStep === 5 && wizCreatedId) && (
              <div className="flex items-center justify-between mt-6">
                <button type="button" onClick={() => setWizStep(s => Math.max(1, s - 1))} className="btn-outline btn-sm" style={{ visibility: wizStep === 1 ? 'hidden' : 'visible' }}>
                  Back
                </button>
                {wizStep < 5 && (
                  <button type="button" onClick={() => setWizStep(s => Math.min(5, s + 1))} disabled={wizStep === 3 && cfgChapters.length === 0}
                    className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, var(--arena-gold), var(--arena-crimson))', color: '#1a1206', border: 'none' }}>
                    Next
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Player-profile drawer ────────────────────────────────────────── */}
      {drawerParticipant && (
        <div className="fixed inset-0 z-30" style={{ background: 'rgba(4,3,8,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setDrawerParticipant(null)}>
          <div onClick={e => e.stopPropagation()} className="fixed top-0 right-0 h-screen flex flex-col" style={{
            width: 320, maxWidth: '90vw', background: 'var(--arena-surface)', borderLeft: '1px solid var(--arena-border)', padding: '26px 22px',
            animation: 'arenaSlideIn .28s cubic-bezier(.2,.8,.2,1)',
          }}>
            <button type="button" onClick={() => setDrawerParticipant(null)} className="w-7 h-7 rounded-lg flex items-center justify-center mb-5" style={{ background: 'var(--arena-surface2)', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
                {drawerParticipant.initials}
              </div>
              <div className="font-bold text-sm">{drawerParticipant.name}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {drawerParticipant.uid === battle?.hostId ? 'Host of this battle' : 'Battling in this room'}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-center" style={{ color: 'var(--text-faint)' }}>
              Per-player stats and badges aren't tracked yet — this is a real classmate battling live in this room.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes arenaFade { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        @keyframes arenaSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
