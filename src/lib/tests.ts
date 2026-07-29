import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
  query, where, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TestType   = 'faculty_batch' | 'faculty_coaching' | 'ai' | 'custom' | 'mock' | 'pyq';

// Every attempt is tagged with the kind of test it was, so Test History can
// categorise it (mock / custom / ai / battle / practice / assigned / coaching / pyq).
export type AttemptType = TestType | 'battle' | 'practice';

export const ATTEMPT_TYPE_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  mock:              { label: 'Mock Test',    color: '#5B4FE8', bg: 'rgba(91,79,232,0.10)',  icon: 'quiz' },
  custom:            { label: 'Custom Test',  color: '#0891B2', bg: 'rgba(8,145,178,0.10)',  icon: 'tune' },
  ai:                { label: 'AI Test',      color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', icon: 'auto_awesome' },
  battle:            { label: 'Battle',       color: '#EA580C', bg: 'rgba(234,88,12,0.10)',  icon: 'sports_esports' },
  practice:          { label: 'Practice',     color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: 'edit_note' },
  faculty_batch:     { label: 'Assigned Test',color: '#059669', bg: 'rgba(16,185,129,0.10)', icon: 'assignment' },
  faculty_coaching:  { label: 'Coaching Test',color: '#D97706', bg: 'rgba(245,158,11,0.10)', icon: 'verified' },
  pyq:               { label: 'PYQ Paper',    color: '#B45309', bg: 'rgba(180,83,9,0.10)',   icon: 'history_edu' },
};
export type TestStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'final_rejected' | 'active' | 'closed';

// Feature 8 — optional verification stage between faculty submission and final admin approval.
export type VerificationStage = 'none' | 'awaiting' | 'verified' | 'rejected';
export interface TestVerification {
  stage:                VerificationStage;
  verifierId?:          string;
  verifierName?:        string;
  verifierDesignation?: string;   // HOD / Senior Faculty / Subject Expert
  forwardedAt?:         string;
  decidedAt?:           string;
  remarks?:             string;
}
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';
// Feature 2 — browser security mode chosen by faculty at test creation.
//  'open'   → tab switching allowed; every switch is logged & the student is flagged.
//  'locked' → complete lock: block tab-switch/copy/paste/right-click/dev-tools, warn,
//             and auto-submit after `autoSubmitViolations` leaves (0 = never auto-submit).
export type LockMode = 'open' | 'locked';

export interface Test {
  id:              string;
  type:            TestType;
  status:          TestStatus;
  title:           string;
  createdBy:       string;
  stream:          string;          // 'JEE' | 'NEET'
  subjects:        string[];
  chapters:        string[];
  difficulty:      Difficulty;
  questionCount:   number;
  durationSeconds: number;
  startAt:         string | null;
  endAt:           string | null;
  instructions:    string;
  negativeMarking: boolean;
  lockMode?:            LockMode;   // Feature 2 (faculty tests). AI/custom tests are always 'open'.
  autoSubmitViolations?: number;    // locked mode: auto-submit after N leaves (0 = never)
  questionMarks?:  Record<string, number>;  // Feature 7 — per-question marks (manual builder)
  questionTimes?:  Record<string, number>;  // Feature 7 — per-question seconds (manual builder)
  assignedTo:      string[] | 'all';
  questionIds:     string[];
  rejectionNote?:  string;
  verification?:   TestVerification;   // Feature 8
  createdAt:       string;
  updatedAt:       string;
}

export interface TestAttempt {
  id:            string;
  testId:        string;
  studentId:     string;
  answers:       Record<string, 'A' | 'B' | 'C' | 'D'>;
  score:         number;
  correctCount:  number;
  incorrectCount:number;
  skippedCount:  number;
  accuracyPct:   number;
  timeSeconds:   number;
  status:        'in_progress' | 'submitted';
  startedAt:     string;
  submittedAt:   string | null;
  // Denormalised so Test History can categorise & label without extra reads.
  testType?:     AttemptType;
  testTitle?:    string;
  subjects?:     string[];
  questionIds?:  string[];   // the exact questions served (for answer review)
  // Feature 2 — browser-lock telemetry (recorded for every test type).
  tabSwitchCount?:     number;
  tabSwitchEvents?:    Array<{ at: string; awaySeconds: number }>;
  timeOutsideSeconds?: number;
  lockViolations?:     number;   // blocked copy/paste/right-click/dev-tools attempts (locked mode)
  rank?:               number;   // only meaningful for Battle attempts (position among participants)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string')  return v;
  return null;
}

function docToTest(id: string, data: Record<string, unknown>): Test {
  return {
    id,
    type:            data.type            as TestType,
    status:          data.status          as TestStatus,
    title:           data.title           as string,
    createdBy:       data.createdBy       as string,
    stream:          (data.stream         as string) ?? 'JEE',
    subjects:        (data.subjects       as string[]) ?? [],
    chapters:        (data.chapters       as string[]) ?? [],
    difficulty:      data.difficulty      as Difficulty,
    questionCount:   data.questionCount   as number,
    durationSeconds: data.durationSeconds as number,
    startAt:         toIso(data.startAt),
    endAt:           toIso(data.endAt),
    instructions:    (data.instructions   as string) ?? '',
    negativeMarking: (data.negativeMarking as boolean) ?? false,
    lockMode:        (data.lockMode        as LockMode | undefined) ?? undefined,
    autoSubmitViolations: (data.autoSubmitViolations as number | undefined) ?? undefined,
    questionMarks:   (data.questionMarks   as Record<string, number> | undefined) ?? undefined,
    questionTimes:   (data.questionTimes   as Record<string, number> | undefined) ?? undefined,
    assignedTo:      (data.assignedTo     as string[] | 'all') ?? [],
    questionIds:     (data.questionIds    as string[]) ?? [],
    rejectionNote:   data.rejectionNote   as string | undefined,
    verification:    (data.verification   as TestVerification | undefined) ?? undefined,
    createdAt:       toIso(data.createdAt) ?? '',
    updatedAt:       toIso(data.updatedAt) ?? '',
  };
}

function byCreatedDesc(a: Test, b: Test) {
  return b.createdAt.localeCompare(a.createdAt);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTest(
  data: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  // Firestore rejects `undefined` field values — strip them (e.g. optional lockMode).
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const ref = await addDoc(collection(db, 'tests'), {
    ...clean,
    stream: data.stream ?? 'JEE',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateTestStatus(
  testId: string,
  status: TestStatus,
  rejectionNote?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (rejectionNote) updates.rejectionNote = rejectionNote;
  await updateDoc(doc(db, 'tests', testId), updates);
}

// ── Fetch single ──────────────────────────────────────────────────────────────

export async function getTest(testId: string): Promise<Test | null> {
  const snap = await getDoc(doc(db, 'tests', testId));
  if (!snap.exists()) return null;
  return docToTest(snap.id, snap.data() as Record<string, unknown>);
}

// ── Faculty: tests I created ──────────────────────────────────────────────────
// Note: no orderBy — avoids composite-index requirement; sort client-side

export async function getFacultyTests(facultyUid: string): Promise<Test[]> {
  try {
    const q = query(
      collection(db, 'tests'),
      where('createdBy', '==', facultyUid),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToTest(d.id, d.data() as Record<string, unknown>))
      .sort(byCreatedDesc);
  } catch (e) {
    console.error('getFacultyTests error:', e);
    return [];
  }
}

// ── Admin: pending approval ───────────────────────────────────────────────────

export async function getPendingApprovalTests(): Promise<Test[]> {
  try {
    const q = query(
      collection(db, 'tests'),
      where('status', '==', 'pending_approval'),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToTest(d.id, d.data() as Record<string, unknown>))
      .sort(byCreatedDesc);
  } catch (e) {
    console.error('getPendingApprovalTests error:', e);
    return [];
  }
}

// ── Feature 8: multi-level approval workflow ──────────────────────────────────

/** Admin forwards a pending coaching test to a chosen faculty verifier. */
export async function forwardForVerification(
  testId: string,
  verifier: { id: string; name: string; designation: string },
): Promise<void> {
  await updateDoc(doc(db, 'tests', testId), {
    verification: {
      stage: 'awaiting',
      verifierId: verifier.id,
      verifierName: verifier.name,
      verifierDesignation: verifier.designation,
      forwardedAt: new Date().toISOString(),
    },
    updatedAt: serverTimestamp(),
  });
  // Remember this person's designation for future forwards (best-effort).
  try { await setDoc(doc(db, 'users', verifier.id), { designation: verifier.designation }, { merge: true }); } catch { /* ignore */ }
}

/** The verifier approves or rejects, attaching remarks. Returns to admin either way. */
export async function submitVerification(
  testId: string,
  decision: 'verified' | 'rejected',
  remarks: string,
  verifier: { id: string; name: string },
): Promise<void> {
  const snap = await getDoc(doc(db, 'tests', testId));
  const existing = (snap.exists() ? (snap.data().verification ?? {}) : {}) as TestVerification;
  await updateDoc(doc(db, 'tests', testId), {
    verification: {
      ...existing,
      stage: decision,
      verifierId: verifier.id,
      verifierName: verifier.name,
      decidedAt: new Date().toISOString(),
      remarks: remarks ?? '',
    },
    updatedAt: serverTimestamp(),
  });
}

/** Tests currently awaiting the given verifier's review. */
export async function getVerificationQueue(verifierUid: string): Promise<Test[]> {
  try {
    const q = query(collection(db, 'tests'), where('verification.verifierId', '==', verifierUid), limit(100));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToTest(d.id, d.data() as Record<string, unknown>))
      .filter(t => t.verification?.stage === 'awaiting')
      .sort(byCreatedDesc);
  } catch (e) {
    console.error('getVerificationQueue error:', e);
    return [];
  }
}

/** Admin's final decision. 'final_rejected' is terminal — faculty must recreate. */
export async function finalizeApproval(
  testId: string,
  decision: 'approved' | 'final_rejected',
  note?: string,
): Promise<void> {
  const updates: Record<string, unknown> = { status: decision, updatedAt: serverTimestamp() };
  if (note) updates.rejectionNote = note;
  await updateDoc(doc(db, 'tests', testId), updates);
}

// ── Student: assigned faculty_batch tests ─────────────────────────────────────

export async function getAssignedTests(studentUid: string, studentStream?: string): Promise<Test[]> {
  try {
    const now = new Date().toISOString();
    const q = query(
      collection(db, 'tests'),
      where('type', '==', 'faculty_batch'),
      where('status', '==', 'active'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToTest(d.id, d.data() as Record<string, unknown>))
      .filter(t => {
        const assigned = t.assignedTo;
        const inAssigned = assigned === 'all' || (Array.isArray(assigned) && assigned.includes(studentUid));
        const notExpired = !t.endAt || t.endAt > now;
        const streamMatch = !studentStream || !t.stream || t.stream === studentStream;
        return inAssigned && notExpired && streamMatch;
      });
  } catch (e) {
    console.error('getAssignedTests error:', e);
    return [];
  }
}

// ── Student: approved coaching tests ─────────────────────────────────────────

export async function getCoachingTests(studentStream?: string): Promise<Test[]> {
  try {
    const q = query(
      collection(db, 'tests'),
      where('type', '==', 'faculty_coaching'),
      where('status', '==', 'approved'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToTest(d.id, d.data() as Record<string, unknown>))
      .filter(t => !studentStream || !t.stream || t.stream === studentStream)
      .sort(byCreatedDesc);
  } catch (e) {
    console.error('getCoachingTests error:', e);
    return [];
  }
}

// ── Student: PYQ papers ───────────────────────────────────────────────────────

/** Sorted oldest→newest so a student naturally works forward through years. */
export async function getPYQTests(studentStream?: string): Promise<Test[]> {
  try {
    const q = query(collection(db, 'tests'), where('type', '==', 'pyq'), where('status', '==', 'active'), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToTest(d.id, d.data() as Record<string, unknown>))
      .filter(t => !studentStream || !t.stream || t.stream === studentStream)
      .sort((a, b) => a.title.localeCompare(b.title));
  } catch (e) {
    console.error('getPYQTests error:', e);
    return [];
  }
}

// ── Test Attempts ─────────────────────────────────────────────────────────────

export async function saveTestAttempt(attempt: Omit<TestAttempt, 'id'>): Promise<string> {
  const clean = Object.fromEntries(Object.entries(attempt).filter(([, v]) => v !== undefined));
  const ref = await addDoc(collection(db, 'testAttempts'), {
    ...clean,
  });
  return ref.id;
}

// Some attempt docs predate the current save schema and have startedAt /
// submittedAt stored as a Firestore Timestamp instead of the ISO string the
// current saveTestAttempt() writes. Normalizing both shapes to a string here
// (same pattern as docToTest above) means every downstream consumer —
// including the sort below, which used to call .localeCompare() straight on
// whatever came back and threw on a Timestamp — can trust it's always a string.
function docToAttempt(id: string, data: Record<string, unknown>): TestAttempt {
  return {
    ...(data as Omit<TestAttempt, 'id' | 'startedAt' | 'submittedAt'>),
    id,
    startedAt:   toIso(data.startedAt) ?? '',
    submittedAt: toIso(data.submittedAt),
  };
}

// Throws on failure — deliberately NOT swallowed here. A caller that treats a
// failed read the same as "genuinely zero attempts" tells a student their
// saved test history is empty when it's actually just a transient read error.
// Let the caller distinguish the two and offer a retry.
export async function getStudentAttempts(studentUid: string): Promise<TestAttempt[]> {
  // Single where clause — no composite index needed
  const q = query(
    collection(db, 'testAttempts'),
    where('studentId', '==', studentUid),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => docToAttempt(d.id, d.data() as Record<string, unknown>))
    .filter(a => a.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export async function getStudentAttemptCount(studentUid: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'testAttempts'),
      where('studentId', '==', studentUid),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch {
    return 0;
  }
}

export async function getStudentAttemptCounts(studentUid: string): Promise<Record<string, number>> {
  try {
    const q = query(
      collection(db, 'testAttempts'),
      where('studentId', '==', studentUid),
    );
    const snap = await getDocs(q);
    return snap.docs.reduce((counts, d) => {
      const data = d.data() as Record<string, unknown>;
      if ((data.status as string | undefined) !== 'submitted') return counts;
      const testId = data.testId as string | undefined;
      if (!testId) return counts;
      counts[testId] = (counts[testId] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  } catch {
    return {};
  }
}

export async function hasAttempted(testId: string, studentUid: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'testAttempts'),
      where('testId', '==', testId),
      where('studentId', '==', studentUid),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}
