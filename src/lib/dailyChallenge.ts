import { collection, doc, getDoc, getDocs, query, setDoc, where, limit, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getStudentAttempts, type TestAttempt } from './tests';
import { STREAM_SUBJECTS, type StudentStream } from './stream';

export const QUESTIONS_PER_SUBJECT = 5;

// ── Deterministic daily selection ────────────────────────────────────────────
// Same seed (date + subject) always shuffles to the same order, so every
// student sees the identical 5 questions per subject for a given day — a real
// shared "problem of the day", not a per-student random pick — without needing
// a server job: whoever's client asks first generates it, and a second
// student racing to generate it independently computes the exact same result.

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const rand = mulberry32(hashString(seedStr));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dailyTestId(date: string, stream: StudentStream): string {
  return `daily_${date}_${stream}`;
}

export interface DailyChallenge {
  id: string;
  date: string;
  subjects: string[];
  questionIds: string[];
}

/** True for any daily-challenge test id, regardless of the `type` field the
 *  doc was written with (older docs used `type: 'custom'`). */
export function isDailyChallengeTestId(id: string): boolean {
  return id.startsWith('daily_');
}

/** A date ('YYYY-MM-DD') strictly before today — past challenges are
 *  review-only, never re-attemptable. */
export function isPastChallenge(date: string): boolean {
  return date < todayKey();
}

/** Gets the shared daily-challenge test for `date` (defaults to today) and
 *  this stream, creating it (as a real `tests` doc, `type: 'custom'` so it
 *  satisfies the existing student create rule — no security-rule change
 *  needed) if no one has generated it yet. Passing a past date lazily
 *  materialises that day's set using the identical deterministic seed, so
 *  reviewing an old day always shows the same questions it would have. */
export async function getOrCreateDailyChallengeTest(
  uid: string, stream: StudentStream, date: string = todayKey()
): Promise<DailyChallenge> {
  const id = dailyTestId(date, stream);
  const ref = doc(db, 'tests', id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data();
    return { id, date, subjects: (data.subjects as string[]) ?? [], questionIds: (data.questionIds as string[]) ?? [] };
  }

  // Defensive fallback — every real call site already guards `stream` to
  // 'JEE'|'NEET', but an unexpected value here would otherwise throw and
  // leave the "Start Today's Challenge" button silently dead with no
  // visible error (see DailyChallengeCard.tsx's error handling).
  const subjects = STREAM_SUBJECTS[stream] ?? STREAM_SUBJECTS.JEE;
  const questionIds: string[] = [];
  for (const subject of subjects) {
    const snap = await getDocs(query(collection(db, 'questions'), where('subject', '==', subject), limit(200)));
    // Firestore doesn't guarantee document order for an unordered query, so
    // two students' clients racing to create today's challenge could
    // otherwise shuffle a differently-ordered pool into different question
    // sets. Sorting first makes the shuffle input canonical regardless of
    // read order, preserving "identical challenge for every student."
    const pool = snap.docs.map(d => d.id).sort();
    questionIds.push(...seededShuffle(pool, `${date}:${subject}`).slice(0, QUESTIONS_PER_SUBJECT));
  }

  await setDoc(ref, {
    type: 'custom',
    status: 'active',
    title: `Daily Challenge — ${date}`,
    createdBy: uid,
    stream,
    subjects,
    chapters: [],
    difficulty: 'Mixed',
    questionCount: questionIds.length,
    durationSeconds: questionIds.length * 90,
    startAt: new Date().toISOString(),
    endAt: null,
    instructions: `Daily mixed practice — ${QUESTIONS_PER_SUBJECT} questions each from ${subjects.join(', ')}. Same set for every ${stream} student today.`,
    negativeMarking: false,
    lockMode: 'open',
    autoSubmitViolations: 0,
    assignedTo: 'all',
    questionIds,
    isDailyChallenge: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id, date, subjects, questionIds };
}

// ── Real completion tracking — derived from actual submitted attempts, not a
// separate write path, so there's nothing to keep in sync and no touch needed
// to the exam submission flow at all. ───────────────────────────────────────

export async function getDailyChallengeCompletions(uid: string, stream: StudentStream): Promise<Set<string>> {
  const attempts = await getStudentAttempts(uid).catch(() => []);
  const prefix = 'daily_';
  const suffix = `_${stream}`;
  const dates = new Set<string>();
  for (const a of attempts) {
    if (a.status !== 'submitted' || !a.testId) continue;
    if (a.testId.startsWith(prefix) && a.testId.endsWith(suffix)) {
      dates.add(a.testId.slice(prefix.length, a.testId.length - suffix.length));
    }
  }
  return dates;
}

/** This student's own submitted attempt for a specific daily-challenge test,
 *  or null if they never attempted that day — powers the review page's
 *  "your answer vs the correct answer" display. */
export async function getAttemptForDailyChallenge(uid: string, testId: string): Promise<TestAttempt | null> {
  const attempts = await getStudentAttempts(uid).catch(() => []);
  return attempts.find(a => a.testId === testId && a.status === 'submitted') ?? null;
}

/** Every 'YYYY-MM' month (sorted, oldest first) where every real calendar day
 *  was completed — the actual list of earned monthly badges, for display on
 *  the profile page. Only considers months the student has any activity in,
 *  not every month since account creation. */
export function getEarnedBadgeMonths(completed: Set<string>): string[] {
  const months = new Set<string>();
  completed.forEach(dateKey => months.add(dateKey.slice(0, 7)));
  return [...months].filter(mk => isMonthBadgeEarned(mk, completed)).sort();
}

/** True if EVERY real calendar day of `monthKey` ('YYYY-MM') up to today (for
 *  the current month) is in `completed` — matches LeetCode's "finish every
 *  day this month" badge rule. A future/incomplete current month never earns
 *  the badge early. */
export function isMonthBadgeEarned(monthKey: string, completed: Set<string>): boolean {
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m - 1;
  if (isCurrentMonth && today.getDate() < daysInMonth) return false;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!completed.has(key)) return false;
  }
  return true;
}
