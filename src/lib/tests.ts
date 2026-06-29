import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TestType   = 'faculty_batch' | 'faculty_coaching' | 'ai' | 'custom';
export type TestStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'active' | 'closed';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

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
  assignedTo:      string[] | 'all';
  questionIds:     string[];
  rejectionNote?:  string;
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
    assignedTo:      (data.assignedTo     as string[] | 'all') ?? [],
    questionIds:     (data.questionIds    as string[]) ?? [],
    rejectionNote:   data.rejectionNote   as string | undefined,
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
  const ref = await addDoc(collection(db, 'tests'), {
    ...data,
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

// ── Test Attempts ─────────────────────────────────────────────────────────────

export async function saveTestAttempt(attempt: Omit<TestAttempt, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'testAttempts'), {
    ...attempt,
    startedAt:   serverTimestamp(),
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getStudentAttempts(studentUid: string): Promise<TestAttempt[]> {
  try {
    // Single where clause — no composite index needed
    const q = query(
      collection(db, 'testAttempts'),
      where('studentId', '==', studentUid),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<TestAttempt, 'id'>) }))
      .filter(a => a.status === 'submitted')
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  } catch (e) {
    console.error('getStudentAttempts error:', e);
    return [];
  }
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
