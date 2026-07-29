import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import Logo from '../../components/Logo';
import { getAuthSession } from '../../lib/auth';
import { updateStudentProgress } from '../../lib/db';
import {
  currentStudent,
  examMeta,
  genExamQuestions,
  type ExamOption as ExamOptionType,
  type ExamMeta,
} from '../../mocks/student';
import { getQuestionsForChapter, getQuestionsByIds, type ExamQuestion as FirestoreQuestion } from '../../lib/questions';
import { getTest, saveTestAttempt, type LockMode, type AttemptType } from '../../lib/tests';
import { enterFullscreen, exitFullscreen } from '../../lib/fullscreen';
import { updateWeakTopics } from '../../lib/weakTopics';
import { flagQuestion, FLAG_REASONS, type FlagReason } from '../../lib/questionFlags';
import { getChapterFormulas, getSubjectHighlights, generateFormulasAI, type FormulaGroup } from '../../lib/formulas';
import { hasAI } from '../../lib/ai';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import MathText from '../../components/MathText';
import {
  buildSections,
  derivePaletteState,
  sectionOf,
  sectionProgress,
  PALETTE_STYLES,
  type PaletteState,
} from '../../lib/examSections';
import { saveExamProgress, loadExamProgress, clearExamProgress } from '../../lib/examProgress';

const fallbackMeta = examMeta;

type QType = 'single' | 'multiple' | 'numeric';

// Sorted, de-spaced, uppercased letter set — so "C,A" and "a c" both become "A,C".
function normChoice(s: string): string {
  return (s || '')
    .toUpperCase()
    .replace(/[^A-D]/g, '')
    .split('')
    .filter((c, i, a) => a.indexOf(c) === i)
    .sort()
    .join(',');
}

// All-or-nothing grading. single/multiple compare the sorted letter set;
// numeric compares parsed values with a small tolerance (fallback: trimmed text).
function isAnswerCorrect(qType: QType, correct: string | null, given: string | undefined): boolean {
  if (!correct || given == null || given === '') return false;
  if (qType === 'numeric') {
    const a = parseFloat(given), b = parseFloat(correct);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return Math.abs(a - b) < 1e-6;
    return given.trim() === correct.trim();
  }
  return normChoice(given) === normChoice(correct);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function ExamInterface() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const toast     = useToast();
  const confirm   = useConfirm();

  // State from PracticeModule (subject/chapter) or test-based (testId)
  const { subject: stateSubject = 'Physics', chapter: stateChapter = '', testId = null, examTitle: stateTitle = '' } =
    (location.state ?? {}) as { subject?: string; chapter?: string; testId?: string | null; examTitle?: string };
  const [subject, setSubject]             = useState(stateSubject);
  const [chapter, setChapter]             = useState(stateChapter);
  const [testSubjects, setTestSubjects]   = useState<string[]>([]);
  const [testChapters, setTestChapters]   = useState<string[]>([]);
  // Which kind of test this is — drives the Test History category. Chapter-based
  // launches (from Practice / Mock Tests) default to 'practice'; a real Test doc
  // overrides this with its own type once loaded.
  const [attemptType, setAttemptType]     = useState<AttemptType>(testId ? 'mock' : 'practice');

  const [exam, setExam]             = useState<ExamMeta>(fallbackMeta);
  const [questions, setQuestions]   = useState<FirestoreQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [seconds, setSeconds]       = useState(fallbackMeta.durationSeconds);
  const [current, setCurrent]       = useState(1);
  // Answer per question is a string: single => "A", multiple => sorted "A,C",
  // numeric => the typed value. (Was a single option key before Advanced types.)
  const [answers, setAnswers]       = useState<Record<number, string>>({});
  const [marked, setMarked]         = useState<Set<number>>(new Set());
  // Report-a-bad-question — purely additive, never touches scoring/navigation.
  const [flagOpen, setFlagOpen]           = useState(false);
  const [flagReason, setFlagReason]       = useState<FlagReason>(FLAG_REASONS[0]);
  const [flagComment, setFlagComment]     = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flaggedIds, setFlaggedIds]       = useState<Set<string>>(new Set());
  const [sessionId, setSessionId]   = useState<string | null>(null);
  // Questions the student has actually opened — drives the official JEE
  // "Not Visited" (grey) vs "Not Answered" (white) palette distinction.
  const [visited, setVisited]       = useState<Set<number>>(new Set([1]));
  // Which subject tab is active. Sections are derived from the loaded questions.
  const [activeSection, setActiveSection] = useState(0);
  const [resumed, setResumed]       = useState(false);

  // Feature 1 — important formulas shown on the pre-test synopsis screen
  const [formulaGroups, setFormulaGroups] = useState<FormulaGroup[]>([]);
  const [formulasLoading, setFormulasLoading] = useState(false);

  // Pre-test instructions screen + 1-minute countdown
  const [started, setStarted]         = useState(false);
  const [preCountdown, setPreCountdown] = useState(60);
  // Feature 5d — student must stay on the instructions/formula screen for a
  // mandatory 30 seconds before the Start button unlocks.
  const MANDATORY_HOLD = 30;
  const [holdRemaining, setHoldRemaining] = useState(MANDATORY_HOLD);
  // Anti-cheat violations (tab switches, blocked copy/paste, etc.)
  const [violations, setViolations]   = useState(0);
  // Feature 5g — a clearly visible "flagged for tab switching" banner in-exam.
  const [tabFlash, setTabFlash]       = useState(false);
  // Tab-switch enforcement (locked mode): warn, then auto-submit after N leaves
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [multiTabBlocked, setMultiTabBlocked] = useState(false);
  // Feature 2 — effective browser-lock policy for this test
  const [lockMode, setLockMode]         = useState<LockMode>('open');
  const [autoSubmitAfter, setAutoSubmitAfter] = useState(2);
  const tabSwitches = useRef(0);
  const tabEvents   = useRef<Array<{ at: string; awaySeconds: number }>>([]);
  const timeOutsideRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const lockViolationsRef = useRef(0);
  const submitRef   = useRef<() => void>(() => {});
  const submittingRef = useRef(false);

  async function beginTest() {
    await enterFullscreen();
    setStarted(true);
  }

  // Timer countdown — only runs once the test has actually started
  useEffect(() => {
    if (!started) return;
    if (seconds <= 0) { void submitExam(); return; }
    const id = window.setInterval(() => setSeconds(s => s > 0 ? s - 1 : 0), 1000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, started]);

  // Pre-test countdown — auto-starts the test when it hits zero
  useEffect(() => {
    if (started || loading) return;
    if (preCountdown <= 0) { void beginTest(); return; }
    const id = window.setInterval(() => setPreCountdown(s => s > 0 ? s - 1 : 0), 1000);
    return () => window.clearInterval(id);
  }, [preCountdown, started, loading]);

  // Feature 5d — count down the mandatory 30-second hold on the instructions screen.
  useEffect(() => {
    if (started || loading || holdRemaining <= 0) return;
    const id = window.setInterval(() => setHoldRemaining(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [holdRemaining, started, loading]);

  // Feature 2 — browser-lock policy depends on the test type/mode:
  //   • open   (AI, Practice, custom, or faculty "Allow Tab Switching"): switches are
  //             RECORDED and flagged, but nothing is blocked and there is no auto-submit.
  //   • locked (faculty "Complete Lock Mode"): block copy/paste/right-click/dev-tools,
  //             warn on leaving, and auto-submit after `autoSubmitAfter` leaves (0 = never).
  // Every mode records tab-switch telemetry (count, timestamps, seconds away) for analytics.
  useEffect(() => {
    if (!started) return;

    const flagLock = (reason: string) => {
      lockViolationsRef.current += 1;
      setViolations(v => v + 1);
      toast(reason, 'error');
    };

    const onVisibility = () => {
      if (document.hidden) { hiddenAtRef.current = Date.now(); return; }
      // Returned to the exam tab — record how long the student was away.
      const away = hiddenAtRef.current ? Math.round((Date.now() - hiddenAtRef.current) / 1000) : 0;
      hiddenAtRef.current = null;
      tabSwitches.current += 1;
      tabEvents.current.push({ at: new Date().toISOString(), awaySeconds: away });
      timeOutsideRef.current += away;
      setViolations(v => v + 1);

      // Feature 5g — always surface a clearly visible flag banner in-exam.
      setTabFlash(true);
      window.setTimeout(() => setTabFlash(false), 6000);

      if (lockMode === 'locked') {
        if (autoSubmitAfter > 0 && tabSwitches.current >= autoSubmitAfter) {
          toast('Test submitted automatically — you left the exam window too many times.', 'error');
          submitRef.current();
        } else {
          setShowTabWarning(true);
          toast('⚠ Warning: do not leave the exam window. This event has been recorded.', 'error');
        }
      } else {
        toast(`Tab switch recorded (${tabSwitches.current}). Away for ${away}s.`, 'error');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Hard restrictions apply only in Complete Lock Mode.
    let cleanupLock = () => {};
    if (lockMode === 'locked') {
      const onContext = (e: MouseEvent) => { e.preventDefault(); };
      const onSelectStart = (e: Event) => { e.preventDefault(); };
      const onDragStart = (e: DragEvent) => { e.preventDefault(); };
      const onCopyPaste = (e: ClipboardEvent) => { e.preventDefault(); flagLock('Copy / paste is disabled during this test.'); };
      const onKey = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        const blockedCombo = (e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'p', 'u', 's'].includes(k);
        const devTools = k === 'f12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k));
        if (blockedCombo || devTools) { e.preventDefault(); flagLock('Action restricted — this test is in Complete Lock Mode.'); }
      };
      document.addEventListener('contextmenu', onContext);
      document.addEventListener('selectstart', onSelectStart);
      document.addEventListener('dragstart', onDragStart);
      document.addEventListener('copy', onCopyPaste);
      document.addEventListener('cut', onCopyPaste);
      document.addEventListener('paste', onCopyPaste);
      document.addEventListener('keydown', onKey);
      cleanupLock = () => {
        document.removeEventListener('contextmenu', onContext);
        document.removeEventListener('selectstart', onSelectStart);
        document.removeEventListener('dragstart', onDragStart);
        document.removeEventListener('copy', onCopyPaste);
        document.removeEventListener('cut', onCopyPaste);
        document.removeEventListener('paste', onCopyPaste);
        document.removeEventListener('keydown', onKey);
      };
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupLock();
    };
  }, [toast, started, lockMode, autoSubmitAfter]);

  // Feature 2 — locked mode: prevent the same exam being open in a second tab.
  // BroadcastChannel only delivers to OTHER tabs, so a reload never blocks itself.
  useEffect(() => {
    if (!started || lockMode !== 'locked' || !testId) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`cc_exam_${testId}`);
      bc.onmessage = (ev) => {
        if (ev.data === 'ping') bc?.postMessage('already_open');
        else if (ev.data === 'already_open') setMultiTabBlocked(true);
      };
      bc.postMessage('ping');
    } catch { /* BroadcastChannel unsupported — skip */ }
    return () => { bc?.close(); };
  }, [started, lockMode, testId]);


  // Load questions from Firestore — by testId or by subject/chapter
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let qs: FirestoreQuestion[] = [];
      let titleOverride = stateTitle;

      if (testId) {
        try {
          const test = await getTest(testId);
          if (test && test.questionIds.length > 0) {
            qs = await getQuestionsByIds(test.questionIds);
            if (!titleOverride) titleOverride = test.title;
            if (test.subjects.length > 0) { setTestSubjects(test.subjects); setSubject(test.subjects[0]); }
            if (test.chapters.length > 0) { setTestChapters(test.chapters); setChapter(test.chapters[0]); }
            // Tag the attempt with the real test type (mock / custom / ai / assigned…)
            setAttemptType(test.type as AttemptType);
            // Feature 2 — AI/custom tests are always open (logged only); faculty tests use their chosen mode.
            const isFacultyTest = test.type === 'faculty_batch' || test.type === 'faculty_coaching';
            const effMode: LockMode = isFacultyTest ? (test.lockMode ?? 'locked') : 'open';
            setLockMode(effMode);
            setAutoSubmitAfter(effMode === 'locked' ? (test.autoSubmitViolations ?? 2) : 0);
            if (!cancelled && qs.length > 0) {
              const meta: ExamMeta = {
                id: test.id.slice(0, 30),
                title: test.title,
                totalQuestions: qs.length,
                currentIndex: 1,
                durationSeconds: test.durationSeconds,
                candidateId: currentStudent.id,
              };
              setExam(meta);
              setSeconds(test.durationSeconds);
              setCurrent(1);
              setQuestions(qs);
              setLoading(false);
              return;
            }
          }
        } catch { /* fall through */ }
      }

      if (qs.length === 0 && chapter) {
        try {
          qs = await getQuestionsForChapter(subject, chapter, 30);
        } catch { /* fall through */ }
      }

      if (cancelled) return;

      if (qs.length > 0) {
        const durationSeconds = qs.length * 90;
        const meta: ExamMeta = {
          id:              `${subject}-${chapter}`.slice(0, 30),
          title:           titleOverride || `${subject}: ${chapter}`,
          totalQuestions:  qs.length,
          currentIndex:    1,
          durationSeconds,
          candidateId:     currentStudent.id,
        };
        setExam(meta);
        setSeconds(durationSeconds);
        setCurrent(1);
        setQuestions(qs);
      } else {
        const mockQs = genExamQuestions(fallbackMeta.totalQuestions);
        setExam(fallbackMeta);
        setSeconds(fallbackMeta.durationSeconds);
        setCurrent(1);
        setQuestions(mockQs as unknown as FirestoreQuestion[]);
      }

      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, subject, chapter]);

  // Feature 1 — build the "Important Formulas for this Test" list from the
  // subject+chapters actually present in the loaded questions. Static bank first
  // (instant); Gemini fills in any chapter the bank doesn't cover.
  useEffect(() => {
    if (loading || questions.length === 0) return;
    let cancelled = false;

    // Unique subject::chapter pairs across this test
    const pairs = new Map<string, { subject: string; chapter: string }>();
    questions.forEach(q => {
      const s = (q.subject || subject || '').trim();
      const c = (q.chapter || q.section || chapter || '').trim();
      if (s && c) pairs.set(`${s}::${c}`, { subject: s, chapter: c });
    });
    if (pairs.size === 0 && subject && chapter) {
      pairs.set(`${subject}::${chapter}`, { subject, chapter });
    }
    const pairList = [...pairs.values()];

    const groups: FormulaGroup[] = [];
    const aiTargets: Array<{ subject: string; chapter: string }> = [];
    pairList.forEach(({ subject: s, chapter: c }) => {
      const g = getChapterFormulas(s, c);
      if (g && !groups.some(x => x.subject === g.subject && x.chapter === g.chapter)) groups.push(g);
      else if (!g) aiTargets.push({ subject: s, chapter: c });
    });

    // Never show an empty section: fall back to subject highlights.
    if (groups.length === 0) {
      groups.push(...getSubjectHighlights([...new Set(pairList.map(p => p.subject))]));
    }
    setFormulaGroups(groups);

    // Best-effort Gemini fill for up to 3 uncovered chapters.
    if (hasAI() && aiTargets.length > 0) {
      setFormulasLoading(true);
      void (async () => {
        const extra: FormulaGroup[] = [];
        for (const { subject: s, chapter: c } of aiTargets.slice(0, 3)) {
          const formulas = await generateFormulasAI(s, c);
          if (cancelled) return;
          if (formulas.length > 0) extra.push({ subject: s, chapter: c, formulas });
        }
        if (cancelled || extra.length === 0) { if (!cancelled) setFormulasLoading(false); return; }
        // Prefer AI chapter-specific groups; drop generic subject highlights if we now have real matches.
        setFormulaGroups(prev => {
          const base = prev.length > 0 && aiTargets.length >= pairList.length ? [] : prev;
          const merged = [...base];
          extra.forEach(g => { if (!merged.some(x => x.subject === g.subject && x.chapter === g.chapter)) merged.push(g); });
          return merged;
        });
        setFormulasLoading(false);
      })();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, questions]);

  const question   = questions[current - 1];
  const selectedKey = answers[current] ?? null;
  const answered   = Object.keys(answers).length;
  const reviewCount = marked.size;

  const timerClass = seconds <= 300 ? 'danger' : seconds <= 600 ? 'warning' : '';

  // ── Subject sectioning (JEE/NEET-style) ──
  // Questions are grouped by subject; a single-subject practice run collapses
  // to exactly one section, so the tab strip hides itself automatically.
  const sections = useMemo(
    () => buildSections(questions, subject),
    [questions, subject],
  );
  const section = sections[activeSection] ?? sections[0];
  /** Per-subject 1-based number for the question currently on screen. */
  const localNumber = section ? section.indices.indexOf(current) + 1 : current;

  // Keep the active tab in sync when navigation crosses a subject boundary
  // (e.g. Save & Next off the end of Physics lands in Chemistry).
  useEffect(() => {
    if (sections.length === 0) return;
    const owner = sectionOf(sections, current);
    if (owner !== activeSection) setActiveSection(owner);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, sections]);

  // Mark the on-screen question as visited — this is what turns a palette tile
  // from grey ("Not Visited") to white ("Not Answered").
  useEffect(() => {
    if (!started) return;
    setVisited(prev => (prev.has(current) ? prev : new Set(prev).add(current)));
  }, [current, started]);

  // ── Auto-save: mirror every answer/flag/tick to localStorage ──
  useEffect(() => {
    if (!started || loading || !exam.id) return;
    saveExamProgress({
      examId: exam.id,
      answers,
      marked: [...marked],
      visited: [...visited],
      current,
      secondsRemaining: seconds,
    });
  }, [started, loading, exam.id, answers, marked, visited, current, seconds]);

  // ── Resume: restore a saved attempt once questions are loaded ──
  useEffect(() => {
    if (loading || resumed || questions.length === 0 || !exam.id) return;
    setResumed(true);
    const saved = loadExamProgress(exam.id);
    if (!saved) return;

    setAnswers(saved.answers ?? {});
    setMarked(new Set(saved.marked ?? []));
    setVisited(new Set(saved.visited ?? [1]));
    setCurrent(Math.min(Math.max(1, saved.current || 1), questions.length));
    if (saved.secondsRemaining > 0) setSeconds(saved.secondsRemaining);
    // Skip the instructions screen — the student has already begun this paper.
    setStarted(true);
    toast('Resumed your test from where you left off.', 'info');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, questions, exam.id]);

  // Central setter — stores the answer string (or clears when blank) and syncs
  // to the server (best-effort). Works for single, multiple and numeric.
  function commitAnswer(value: string) {
    const v = value.trim();
    if (v === '') { clearResponse(); return; }
    setAnswers(prev => ({ ...prev, [current]: v }));
    if (sessionId) {
      void apiRequest(`/api/exams/sessions/${sessionId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({ questionId: current, answer: v }),
      }).catch(() => undefined);
    }
  }

  // Single-correct: pick one option (replaces).
  function onSelect(key: ExamOptionType['key']) {
    commitAnswer(key);
  }

  // Multiple-correct: toggle an option in/out of the sorted set.
  function onToggleMultiple(key: ExamOptionType['key']) {
    const cur = new Set(normChoice(answers[current] ?? '').split(',').filter(Boolean));
    if (cur.has(key)) cur.delete(key); else cur.add(key);
    commitAnswer(Array.from(cur).sort().join(','));
  }

  function clearResponse() {
    setAnswers(prev => { const next = { ...prev }; delete next[current]; return next; });
    if (sessionId) {
      void apiRequest(`/api/exams/sessions/${sessionId}/clear`, { method: 'PATCH', body: JSON.stringify({ questionId: current }) }).catch(() => undefined);
    }
  }

  function toggleMark() {
    setMarked(prev => {
      const next = new Set(prev);
      const wasMarked = next.has(current);
      if (wasMarked) {
        next.delete(current);
      } else {
        next.add(current);
      }
      if (sessionId) {
        void apiRequest(`/api/exams/sessions/${sessionId}/mark`, { method: 'PATCH', body: JSON.stringify({ questionId: current, marked: !wasMarked }) }).catch(() => undefined);
      }
      return next;
    });
  }

  async function submitFlag() {
    if (!question || flagSubmitting) return;
    const comment = flagComment.trim();
    if (flagReason === 'Other' && !comment) {
      toast('Add a comment describing what looks wrong', 'error');
      return;
    }
    const me = getAuthSession()?.user;
    setFlagSubmitting(true);
    try {
      await flagQuestion({
        questionId: question.id,
        subject: question.subject || subject,
        chapter: question.chapter || question.section || chapter,
        questionText: question.prompt,
        reason: flagReason,
        comment: comment || undefined,
        challengeId: testId ?? undefined,
        flaggedBy: me?.id ?? '',
        flaggedByName: me?.name ?? 'A student',
      });
      setFlaggedIds(prev => new Set(prev).add(question.id));
      setFlagOpen(false);
      setFlagReason(FLAG_REASONS[0]);
      setFlagComment('');
      toast('Reported — a faculty member will review this question', 'success');
    } catch (e) {
      if (e instanceof Error && e.message === 'ALREADY_REPORTED') {
        setFlaggedIds(prev => new Set(prev).add(question.id));
        setFlagOpen(false);
        toast("You've already reported this question", 'error');
      } else {
        toast('Could not submit the report — please try again', 'error');
      }
    } finally {
      setFlagSubmitting(false);
    }
  }

  // Navigation walks the ACTIVE SECTION's index list, not the raw global order —
  // a paper's questions may interleave subjects, so `current + 1` could otherwise
  // jump between Physics and Chemistry mid-section. Stepping past either end of a
  // section rolls into the adjacent one, matching the official CBT behaviour.
  function stepQuestion(delta: 1 | -1) {
    if (sections.length === 0) return;
    const si = sectionOf(sections, current);
    const list = sections[si].indices;
    const pos = list.indexOf(current);
    const nextPos = pos + delta;

    if (nextPos >= 0 && nextPos < list.length) {
      setCurrent(list[nextPos]);
      return;
    }
    const nextSection = sections[si + delta];
    if (!nextSection) return; // first question of the paper, or the very last
    setCurrent(delta === 1 ? nextSection.indices[0] : nextSection.indices[nextSection.indices.length - 1]);
  }

  function saveAndNext() { stepQuestion(1); }
  function previous()    { stepQuestion(-1); }

  /** True when there is nowhere further to step in this direction. */
  function atEdge(delta: 1 | -1): boolean {
    if (sections.length === 0) return true;
    const si = sectionOf(sections, current);
    const list = sections[si].indices;
    const pos = list.indexOf(current);
    if (pos + delta >= 0 && pos + delta < list.length) return false;
    return !sections[si + delta];
  }

  async function submitExam() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    // The attempt is over — drop the resume record so it can't be restored.
    clearExamProgress(exam.id);

    try {
      let apiResult: Record<string, unknown> = {};
      if (sessionId) {
        try {
          apiResult = await apiRequest(`/api/exams/sessions/${sessionId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }) as Record<string, unknown>;
        } catch { /* continue */ }
      }

      // Per-chapter AND overall stats — uses question.subject/chapter from Firestore
      let correctCount = 0;
      let incorrectCount = 0;
      let unscoredCount = 0; // questions with no verified correct answer on record
      const diffStats: Record<string, { correct: number; total: number }> = {};
      const chapterStats: Record<string, { subject: string; chapter: string; correct: number; incorrect: number; total: number }> = {};

      questions.forEach((q, i) => {
        const qNum     = i + 1;
        const diff     = q.difficulty || 'Medium';
        const qSubject = q.subject || subject;
        const qChapter = q.chapter || q.section || chapter || 'Unknown';
        const key      = `${qSubject}::${qChapter}`;

        // A question with no correct answer on record can't be graded — never
        // score the student's response against it (previously this silently
        // marked every answer, including the correct one, as wrong).
        if (!q.answer) {
          unscoredCount++;
          return;
        }

        if (!diffStats[diff]) diffStats[diff] = { correct: 0, total: 0 };
        diffStats[diff].total++;
        if (!chapterStats[key]) chapterStats[key] = { subject: qSubject, chapter: qChapter, correct: 0, incorrect: 0, total: 0 };
        chapterStats[key].total++;

        const given = answers[qNum];
        if (given !== undefined && given !== '') {
          const qType = (q.questionType ?? 'single') as QType;
          if (isAnswerCorrect(qType, q.answer, given)) {
            correctCount++;
            diffStats[diff].correct++;
            chapterStats[key].correct++;
          } else {
            incorrectCount++;
            chapterStats[key].incorrect++;
          }
        }
      });

      if (unscoredCount > 0) {
        toast(`${unscoredCount} question${unscoredCount === 1 ? '' : 's'} in this test could not be graded (missing answer key) and were excluded from scoring.`, 'info');
      }

      const skippedCount = exam.totalQuestions - correctCount - incorrectCount;
      const accuracyPct  = exam.totalQuestions > 0 ? Math.round((correctCount / exam.totalQuestions) * 100) : 0;
      const score        = (apiResult.score as number) ?? Math.max(0, correctCount * 4 - incorrectCount);
      const safePct      = (c: number, t: number) => t > 0 ? Math.round(c / t * 100) : 0;
      const timeMinutes  = Math.max(1, Math.round((exam.durationSeconds - seconds) / 60));

      // Build per-topic accuracy array (one entry per chapter)
      const topicAccuracy = Object.values(chapterStats).map(s => ({
        topic:   s.chapter,
        subject: s.subject,
        pct:     s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        correct: s.correct,
        total:   s.total,
      }));

      // All subjects/chapters from the test
      const allSubjects = testSubjects.length > 0 ? testSubjects : [subject];
      const allChapters = testChapters.length > 0 ? testChapters : topicAccuracy.map(t => t.topic);

      const uid = getAuthSession()?.user?.id;

      // Update weak topics for every chapter attempted
      if (uid) {
        void updateWeakTopics(uid, Object.values(chapterStats).map(s => ({
          subject: s.subject, chapter: s.chapter, correct: s.correct, incorrect: s.incorrect,
        })));
      }

      // Log EVERY attempt (mock, custom, ai, assigned, and chapter practice) so it
      // shows up in Review Tests — not only faculty tests. Practice runs with no
      // real Test doc get a synthetic id so answer review still works.
      //
      // This write must never block the student from reaching the results screen.
      // A Firestore failure here (network blip, transient quota error) used to
      // reject the whole submitExam() call and leave the student stuck on the
      // exam screen with nothing saved and no explanation — retry once, and if
      // it still fails, let them through anyway with a visible warning instead
      // of silently losing the attempt.
      if (uid) {
        const attemptTestId = testId ?? `practice:${subject}:${chapter || 'general'}`;
        const attemptPayload = {
          testId:        attemptTestId,
          studentId:     uid,
          answers:       Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v as 'A'|'B'|'C'|'D'])),
          score, correctCount, incorrectCount, skippedCount, accuracyPct,
          timeSeconds:   exam.durationSeconds - seconds,
          status:        'submitted' as const,
          startedAt:     new Date().toISOString(),
          submittedAt:   new Date().toISOString(),
          // Test History categorisation + labelling
          testType:      attemptType,
          testTitle:     exam.title,
          subjects:      allSubjects,
          questionIds:   questions.map(q => q.id),
          // Feature 2 — browser-lock telemetry
          tabSwitchCount:     tabSwitches.current,
          tabSwitchEvents:    tabEvents.current,
          timeOutsideSeconds: timeOutsideRef.current,
          lockViolations:     lockViolationsRef.current,
        };

        try {
          await saveTestAttempt(attemptPayload);
        } catch {
          await new Promise(r => setTimeout(r, 800));
          try {
            await saveTestAttempt(attemptPayload);
          } catch (e) {
            console.error('saveTestAttempt failed after retry', e);
            toast('Your result is shown below, but this attempt could not be saved to Review Tests. Please check your connection.', 'error');
          }
        }

        // Never throws internally (see updateStudentProgress) — safe to await.
        await updateStudentProgress(uid, {
          lastActivity: {
            type:        'test',
            title:       exam.title,
            score:       accuracyPct,
            accuracy:    accuracyPct,
            completedAt: new Date().toISOString(),
          },
          completedTests: 1,
          latestTestResult: {
            testTitle:      exam.title,
            testDate:       new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            subject,
            chapter,
            subjects:       allSubjects,
            chapters:       allChapters,
            totalQuestions: exam.totalQuestions,
            correctCount,
            incorrectCount,
            skippedCount,
            accuracyPct,
            score,
            timeMinutes,
            easyPct:   safePct(diffStats['Easy']?.correct   ?? 0, diffStats['Easy']?.total   ?? 0),
            mediumPct: safePct(diffStats['Medium']?.correct ?? 0, diffStats['Medium']?.total ?? 0),
            hardPct:   safePct(diffStats['Hard']?.correct   ?? 0, diffStats['Hard']?.total   ?? 0),
            topicAccuracy,
          },
        });
      }

      navigate(pathFor('chatbot'), {
        state: {
          score, correctCount, incorrectCount, skippedCount, accuracyPct,
          examTitle:      exam.title,
          subject,
          chapter,
          subjects:       allSubjects,
          chapters:       allChapters,
          topicAccuracy,
          totalQuestions: exam.totalQuestions,
          // Feature 2 — exam-integrity telemetry
          integrity: {
            lockMode,
            tabSwitchCount:     tabSwitches.current,
            timeOutsideSeconds: timeOutsideRef.current,
            lockViolations:     lockViolationsRef.current,
          },
        },
      });
    } finally {
      submittingRef.current = false;
      void exitFullscreen();
    }
  }

  useEffect(() => {
    submitRef.current = () => {
      void submitExam();
    };
  }, [submitExam]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: '#5B4FE8', borderTopColor: 'transparent' }} />
          <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>Loading questions…</p>
        </div>
      </div>
    );
  }

  // ── Pre-test instructions / rules screen with 1-minute countdown ──
  if (!started) {
    const totalMarks  = exam.totalQuestions * 4;
    const durationMin = Math.max(1, Math.round(exam.durationSeconds / 60));
    const mm = Math.floor(preCountdown / 60);
    const ss = preCountdown % 60;
    const rules = lockMode === 'locked'
      ? [
          'Copy, paste, cut and right-click are disabled throughout the test.',
          autoSubmitAfter > 0
            ? `Do NOT leave the exam window — you will be warned, and the test auto-submits after ${autoSubmitAfter} leave${autoSubmitAfter === 1 ? '' : 's'}.`
            : 'Do NOT leave the exam window — you will be warned and every leave is recorded.',
          'Opening this exam in a second browser tab is blocked.',
          'The timer starts the moment the test begins and will not pause.',
          'Use the question palette to move between questions; your answers auto-save.',
          'AI proctoring is active for the full duration of the test.',
        ]
      : [
          'You may switch tabs if you need to — but every switch and the time you spend away is recorded and shown in your analytics.',
          'Repeated tab switching is flagged for your faculty.',
          'Nothing is blocked in this mode, so please keep your focus on the test.',
          'The timer starts the moment the test begins and will not pause.',
          'Use the question palette to move between questions; your answers auto-save.',
          'AI proctoring is active for the full duration of the test.',
        ];
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}>
        <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
          <div className="px-8 py-6" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
            <div className="flex items-center gap-2 mb-2">
              <img src="/logo.png" alt="Concept Crack" className="w-7 h-7 rounded-lg object-cover" />
              <span className="text-white/80 text-xs font-bold uppercase tracking-widest">Concept Crack · Exam</span>
            </div>
            <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{exam.title}</h1>
            <p className="text-white/80 text-sm mt-1">Read the instructions carefully before you begin.</p>
          </div>

          <div className="p-8 space-y-6">
            {/* Countdown */}
            <div className="flex flex-col items-center gap-1 py-2">
              <span className="text-label-sm uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Test begins in</span>
              <div className="text-5xl font-bold font-mono" style={{ color: preCountdown <= 10 ? '#EF4444' : '#5B4FE8' }}>
                {mm}:{ss < 10 ? '0' : ''}{ss}
              </div>
            </div>

            {/* Test details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Questions',   value: String(exam.totalQuestions), icon: 'quiz' },
                { label: 'Duration',    value: `${durationMin} min`,        icon: 'timer' },
                { label: 'Marking',     value: '+4 / −1',                   icon: 'calculate' },
                { label: 'Total Marks', value: String(totalMarks),          icon: 'star' },
              ].map(d => (
                <div key={d.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#5B4FE8' }}>{d.icon}</span>
                  <div className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{d.value}</div>
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{d.label}</div>
                </div>
              ))}
            </div>

            {/* Lock Mode banner — enlarged, prominent message (5e) */}
            {lockMode === 'locked' && (
              <div className="rounded-xl px-4 py-3.5 flex items-start gap-3" style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: '26px', color: '#DC2626' }}>lock</span>
                <div>
                  <div className="text-base font-bold" style={{ color: '#DC2626' }}>Complete Lock Mode is ON</div>
                  <p className="text-sm mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Copy, paste, right-click and dev-tools are disabled. Leaving the exam window is recorded
                    {autoSubmitAfter > 0 ? ` and the test auto-submits after ${autoSubmitAfter} leave${autoSubmitAfter === 1 ? '' : 's'}.` : ' and flagged for your faculty.'}
                  </p>
                </div>
              </div>
            )}

            {/* Rules */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Test Rules</h2>
                <span
                  className="text-label-sm font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={lockMode === 'locked'
                    ? { backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }
                    : { backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{lockMode === 'locked' ? 'lock' : 'lock_open'}</span>
                  {lockMode === 'locked' ? 'Locked Mode' : 'Open · switches logged'}
                </span>
              </div>
              <ul className="space-y-2.5">
                {rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: '#10B981' }}>check_circle</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Important formulas for this test (Feature 1) */}
            {(formulaGroups.length > 0 || formulasLoading) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#5B4FE8' }}>functions</span>
                    Important Formulas for this Test
                  </h2>
                  {formulasLoading && (
                    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#5B4FE8', borderTopColor: 'transparent' }} />
                      Adding more…
                    </span>
                  )}
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {formulaGroups.map(group => (
                    <div
                      key={`${group.subject}::${group.chapter}`}
                      className="rounded-xl p-4"
                      style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8' }}>
                          {group.subject}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{group.chapter}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {group.formulas.map((f, i) => (
                          <div key={i} className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{f.name}</span>
                            <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{f.expr}</span>
                            {f.note && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{f.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
                  Auto-selected from this test's subjects &amp; chapters. The timer keeps running while you revise.
                </p>
              </div>
            )}

            {/* Mandatory 30-second hold (5d) */}
            {holdRemaining > 0 && (
              <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'rgba(91,79,232,0.06)', border: '1px solid rgba(91,79,232,0.20)' }}>
                <div className="relative w-9 h-9 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#5B4FE8" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 15}
                      strokeDashoffset={2 * Math.PI * 15 * (holdRemaining / MANDATORY_HOLD)} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: '#5B4FE8' }}>{holdRemaining}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Please read the instructions and formulas. You can start in <strong>{holdRemaining}s</strong>.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void beginTest()}
                disabled={holdRemaining > 0}
                className="btn-primary btn-md w-full sm:flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_arrow</span>
                {holdRemaining > 0 ? `Start Test (${holdRemaining}s)` : 'Start Test Now'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-outline btn-md w-full sm:w-auto justify-center"
              >
                Cancel
              </button>
            </div>
            <p className="text-center text-xs" style={{ color: 'var(--text-faint)' }}>
              The test starts automatically when the countdown reaches zero — after the mandatory {MANDATORY_HOLD}-second review.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)', userSelect: lockMode === 'locked' ? 'none' : 'auto' }}
    >
      {/* ── Top bar ── */}
      <header
        className="fixed top-0 left-0 right-0 flex items-center justify-between gap-3 px-3 sm:px-6 h-16"
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', zIndex: 50 }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Logo size="sm" tone="theme" />
          </div>
          <div className="hidden sm:block w-px h-5 shrink-0" style={{ backgroundColor: 'var(--border)' }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{exam.title}</div>
            <div className="hidden sm:block text-xs truncate" style={{ color: 'var(--text-faint)', letterSpacing: '0.05em' }}>SESSION: {exam.id}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Progress mini */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-semibold px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
            <span><span style={{ color: '#10B981' }}>{answered}</span> answered</span>
            <span><span style={{ color: '#7C3AED' }}>{reviewCount}</span> marked</span>
            <span><span style={{ color: '#EF4444' }}>{exam.totalQuestions - answered}</span> remaining</span>
          </div>

          {/* Timer */}
          <div
            className={`exam-timer ${timerClass}`}
            aria-live="polite"
            aria-label={`Time remaining: ${formatTime(seconds)}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>timer</span>
            <span className="font-mono font-bold" style={{ letterSpacing: '0.06em' }}>{formatTime(seconds)}</span>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={async () => {
              const remaining = exam.totalQuestions - answered;
              const ok = await confirm({
                title: 'Submit your exam?',
                message: remaining > 0
                  ? `You have answered ${answered} of ${exam.totalQuestions} questions. ${remaining} unanswered question${remaining === 1 ? '' : 's'} will be marked as skipped. This cannot be undone.`
                  : `All ${exam.totalQuestions} questions answered. Submit your final answers? This cannot be undone.`,
                confirmLabel: 'Submit exam',
                cancelLabel: 'Keep working',
                tone: remaining > 0 ? 'warning' : 'success',
                icon: 'send',
              });
              if (ok) void submitExam();
            }}
            className="btn-primary btn-md"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
            Submit
          </button>
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex flex-col lg:flex-row pt-16 min-h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
        {/* Question area */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
          {/* Subject tabs — only shown for multi-subject papers */}
          {sections.length > 1 && (
            <nav
              className="shrink-0 flex items-stretch gap-1 px-4 sm:px-6 overflow-x-auto"
              style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
              aria-label="Exam subjects"
            >
              {sections.map((s, i) => {
                const prog = sectionProgress(s, answers, marked);
                const isActive = i === activeSection;
                return (
                  <button
                    key={s.subject}
                    type="button"
                    onClick={() => { setActiveSection(i); setCurrent(s.indices[0]); }}
                    aria-current={isActive ? 'page' : undefined}
                    className="relative shrink-0 px-4 py-3 text-left transition-colors"
                    style={{
                      borderBottom: `3px solid ${isActive ? s.color : 'transparent'}`,
                      color: isActive ? s.color : 'var(--text-muted)',
                    }}
                  >
                    <span className="block text-sm font-bold whitespace-nowrap">{s.subject}</span>
                    <span className="block text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>
                      {prog.answered} / {prog.total} answered
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {/* Question meta */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: section ? `linear-gradient(135deg, ${section.color}, ${section.color}CC)` : 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                  >
                    {localNumber}
                  </span>
                  <div>
                    <div className="text-body-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                      Question {localNumber} of {section?.indices.length ?? exam.totalQuestions}
                    </div>
                    <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>
                      {section?.subject ?? 'General'} · {question.section ?? 'General'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-label-sm font-bold px-3 py-1 rounded-full"
                    style={
                      question.difficulty === 'Hard'   ? { backgroundColor: 'rgba(239,68,68,0.10)', color: '#EF4444' } :
                      question.difficulty === 'Medium' ? { backgroundColor: 'rgba(245,158,11,0.10)', color: '#B45309' } :
                      { backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }
                    }
                  >
                    {question.difficulty}
                  </span>
                  {marked.has(current) && (
                    <span className="text-label-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(124,58,237,0.10)', color: '#6D28D9' }}>
                      Marked for Review
                    </span>
                  )}
                  {flaggedIds.has(question.id) ? (
                    <span className="text-label-sm font-bold px-3 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flag</span> Reported
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setFlagOpen(v => !v); setFlagReason(FLAG_REASONS[0]); setFlagComment(''); }}
                      title="Report an issue with this question"
                      className="text-label-sm font-semibold px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                      style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flag</span> Report
                    </button>
                  )}
                </div>
              </div>

              {flagOpen && (
                <div className="rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <label className="text-label-sm font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                    What's wrong with this question?
                  </label>
                  <select
                    value={flagReason}
                    onChange={e => setFlagReason(e.target.value as FlagReason)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    {FLAG_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <textarea
                    value={flagComment}
                    onChange={e => setFlagComment(e.target.value)}
                    rows={2}
                    placeholder={flagReason === 'Other' ? 'Describe the issue… (required)' : 'Additional comment (optional)'}
                    className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setFlagOpen(false)} className="btn-outline btn-sm">Cancel</button>
                    <button type="button" onClick={() => void submitFlag()} disabled={flagSubmitting} className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                      {flagSubmitting ? 'Reporting…' : 'Submit report'}
                    </button>
                  </div>
                </div>
              )}

              {/* Question text */}
              <div
                className="rounded-xl p-6 mb-6 text-base leading-relaxed"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '16px', lineHeight: '1.7' }}
              >
                {question.bodyBlocks ? (
                  question.bodyBlocks.map((b, i) =>
                    b.type === 'image' ? (
                      <img key={i} src={b.imageUrl} alt="Question figure" className="rounded-lg max-h-80 my-4 mx-auto block" />
                    ) : (
                      <div key={i} className="mb-2 last:mb-0"><MathText text={b.content} /></div>
                    )
                  )
                ) : (
                  <>
                    {question.imageUrl && (
                      <img src={question.imageUrl} alt="Question figure" className="rounded-lg max-h-80 mb-4 mx-auto" />
                    )}
                    <MathText text={question.prompt} />
                  </>
                )}
              </div>

              {/* Answer-type hint for Advanced questions */}
              {(question.questionType === 'multiple' || question.questionType === 'numeric') && (
                <div className="mb-3">
                  <span className="text-label-sm font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8' }}>
                    {question.questionType === 'multiple' ? 'One or more correct' : 'Numeric answer'}
                  </span>
                </div>
              )}

              {question.questionType === 'numeric' ? (
                /* Numeric-answer input */
                <input
                  type="text"
                  inputMode="decimal"
                  value={answers[current] ?? ''}
                  onChange={e => commitAnswer(e.target.value)}
                  placeholder="Enter your answer"
                  className="w-full text-base"
                  style={{
                    borderRadius: '10px',
                    border: `1.5px solid ${answers[current] ? '#5B4FE8' : 'var(--border)'}`,
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    padding: '14px 16px',
                  }}
                />
              ) : (
                /* Single- or multiple-correct options */
                <div className="space-y-3">
                  {question.options.map((opt: any) => {
                    const isMultiple = question.questionType === 'multiple';
                    const chosen = normChoice(answers[current] ?? '').split(',').filter(Boolean);
                    const isSelected = isMultiple ? chosen.includes(opt.key) : selectedKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => (isMultiple ? onToggleMultiple(opt.key) : onSelect(opt.key))}
                        className="w-full text-left transition-all duration-150"
                        style={{
                          borderRadius: '10px',
                          border: `1.5px solid ${isSelected ? '#5B4FE8' : 'var(--border)'}`,
                          backgroundColor: isSelected ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 0 0 3px rgba(91,79,232,0.12)' : 'var(--shadow-xs)',
                        }}
                      >
                        <div
                          className="w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0"
                          style={{
                            // square for multiple (checkbox), rounded for single (radio)
                            borderRadius: isMultiple ? '6px' : '10px',
                            backgroundColor: isSelected ? '#5B4FE8' : 'var(--surface-muted)',
                            color: isSelected ? '#fff' : 'var(--text-muted)',
                            border: isSelected ? 'none' : '1.5px solid var(--border)',
                          }}
                        >
                          {isMultiple && isSelected ? '✓' : opt.key}
                        </div>
                        {opt.imageUrl ? (
                          <img src={opt.imageUrl} alt={`Option ${opt.key}`} className="max-h-24 rounded-md" style={{ background: '#fff' }} />
                        ) : (
                          <span
                            className="text-base"
                            style={{ color: isSelected ? '#5B4FE8' : 'var(--text-primary)', fontWeight: isSelected ? 500 : 400 }}
                          >
                            <MathText text={opt.text} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer controls */}
          <footer
            className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4"
            style={{ backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-2 order-2 sm:order-1">
              <button
                type="button"
                onClick={clearResponse}
                className="btn-ghost btn-md"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
                <span className="hidden sm:inline">Clear Response</span>
              </button>
              <button
                type="button"
                onClick={toggleMark}
                className={`btn-md ${marked.has(current) ? '' : 'btn-outline'}`}
                style={marked.has(current) ? { backgroundColor: 'rgba(124,58,237,0.12)', color: '#6D28D9', border: '1px solid rgba(124,58,237,0.30)' } : undefined}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {marked.has(current) ? 'bookmark' : 'bookmark_add'}
                </span>
                <span className="hidden sm:inline">{marked.has(current) ? 'Marked for Review' : 'Mark for Review'}</span>
              </button>
            </div>
            <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={previous}
                disabled={atEdge(-1)}
                className="btn-outline btn-md"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                Previous
              </button>
              <button
                type="button"
                onClick={saveAndNext}
                disabled={atEdge(1)}
                className="btn-primary btn-md"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              >
                Save & Next
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>
          </footer>
        </main>

        {/* Question palette sidebar */}
        <aside
          className="w-full lg:w-72 shrink-0 flex flex-col overflow-y-auto"
          style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        >
          {/* Student info */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="avatar avatar-md">{currentStudent.initials}</div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{currentStudent.name}</div>
                <div className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>ID: {currentStudent.id}</div>
              </div>
            </div>
            {/* Per-subject progress */}
            <div className="space-y-2.5">
              {sections.map(s => {
                const prog = sectionProgress(s, answers, marked);
                const pct = prog.total === 0 ? 0 : Math.round((prog.answered / prog.total) * 100);
                return (
                  <div key={s.subject}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>{s.subject}</span>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                        {prog.answered} / {prog.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-muted)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend — official JEE Main / NEET status colours */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {(['not-visited', 'not-answered', 'answered', 'marked', 'answered-marked'] as PaletteState[]).map(state => {
                const s = PALETTE_STYLES[state];
                return (
                  <div key={state} className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0 relative"
                      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
                    >
                      {state === 'answered-marked' && (
                        <span
                          className="absolute rounded-full"
                          style={{ width: 6, height: 6, backgroundColor: '#10B981', right: -1, bottom: -1, border: '1px solid #fff' }}
                        />
                      )}
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-subject question palettes — numbering restarts inside each subject */}
          <div className="flex-1 p-4 space-y-5">
            {sections.map((s, si) => (
              <div key={s.subject}>
                <button
                  type="button"
                  onClick={() => { setActiveSection(si); setCurrent(s.indices[0]); }}
                  className="flex items-center gap-2 mb-2 w-full text-left"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span
                    className="text-overline uppercase"
                    style={{ color: si === activeSection ? s.color : 'var(--text-faint)' }}
                  >
                    {s.subject}
                  </span>
                </button>
                <div className="grid grid-cols-5 gap-1.5">
                  {s.indices.map((globalIdx, localIdx) => {
                    const state = derivePaletteState(globalIdx, answers, marked, visited);
                    const styles = PALETTE_STYLES[state];
                    const isCurrent = globalIdx === current;
                    const qNum = localIdx + 1;
                    return (
                      <button
                        key={globalIdx}
                        type="button"
                        onClick={() => { setActiveSection(si); setCurrent(globalIdx); }}
                        className="palette-btn relative"
                        aria-label={`${s.subject} question ${qNum}, ${styles.label}`}
                        aria-current={isCurrent ? 'true' : undefined}
                        style={{
                          backgroundColor: styles.bg,
                          color: styles.color,
                          border: `1px solid ${styles.border}`,
                          outline: isCurrent ? `2px solid ${s.color}` : 'none',
                          outlineOffset: '2px',
                        }}
                      >
                        {qNum}
                        {state === 'answered-marked' && (
                          <span
                            className="absolute rounded-full"
                            style={{ width: 7, height: 7, backgroundColor: '#10B981', right: -2, bottom: -2, border: '1.5px solid var(--surface)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* AI Proctor — single monitoring status (also carries the live flag count) */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: '#EF4444' }} />
              <div className="flex-1 min-w-0">
                <div className="text-label-sm font-semibold" style={{ color: '#DC2626' }}>You are being monitored</div>
                <div className="text-[10px]" style={{ color: '#EF4444' }}>AI proctoring active · real-time</div>
              </div>
              {violations > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#DC2626' }}
                  title="Integrity flags detected (tab switches / blocked actions)"
                >
                  {violations} flag{violations > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>

      {multiTabBlocked && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 text-center shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>tab_close</span>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>This exam is already open</h2>
            <p className="text-sm leading-6 mb-5" style={{ color: 'var(--text-secondary)' }}>
              This test is running in another browser tab. To keep the exam secure, it can only be open in one place. Close this tab and continue in the original one.
            </p>
            <button
              type="button"
              className="btn-outline btn-md w-full justify-center"
              onClick={() => navigate(-1)}
            >
              Go back
            </button>
          </div>
        </div>
      )}

      {showTabWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(3,7,18,0.72)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#EF4444' }}>Integrity warning</p>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Last chance to stay in the test</h2>
              </div>
            </div>
            <p className="text-sm leading-6 mb-5" style={{ color: 'var(--text-secondary)' }}>
              You switched away from the exam. One more tab switch or window leave will automatically submit your test.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-primary btn-md flex-1 justify-center"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                onClick={() => setShowTabWarning(false)}
              >
                I understand
              </button>
              <button
                type="button"
                className="btn-outline btn-md"
                onClick={() => {
                  setShowTabWarning(false);
                  void submitRef.current();
                }}
              >
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 5g — clearly visible "flagged for tab switching" banner */}
      {tabFlash && (
        <div
          className="fixed left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-3 rounded-xl"
          style={{
            top: '76px',
            backgroundColor: '#DC2626',
            color: '#fff',
            boxShadow: '0 10px 40px rgba(220,38,38,0.45)',
            zIndex: 75,
          }}
          role="alert"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>flag</span>
          <div>
            <div className="text-sm font-bold">Flagged for Tab Switching</div>
            <div className="text-xs text-white/85">This has been recorded and reported to your faculty ({tabSwitches.current} total).</div>
          </div>
        </div>
      )}

    </div>
  );
}
