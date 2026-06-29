import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TestType = 'faculty_batch' | 'faculty_coaching' | 'ai' | 'custom';
export type TestStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'active' | 'closed';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

export interface Test {
  id: string;
  type: TestType;
  status: TestStatus;
  title: string;
  createdBy: string;           // uid
  subjects: string[];
  chapters: string[];
  difficulty: Difficulty;
  questionCount: number;
  durationSeconds: number;
  startAt: string | null;      // ISO string
  endAt: string | null;
  instructions: string;
  negativeMarking: boolean;
  assignedTo: string[] | 'all';
  questionIds: string[];        // pre-fetched from questions/ collection
  rejectionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  score: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracyPct: number;
  timeSeconds: number;
  status: 'in_progress' | 'submitted';
  startedAt: string;
  submittedAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function docToTest(id: string, data: Record<string, unknown>): Test {
  const toIso = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string | null) ?? null;
  return {
    id,
    type:            data.type            as TestType,
    status:          data.status          as TestStatus,
    title:           data.title           as string,
    createdBy:       data.createdBy       as string,
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

// ── Create test ───────────────────────────────────────────────────────────────

export async function createTest(
  data: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'tests'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Update test ───────────────────────────────────────────────────────────────

export async function updateTestStatus(
  testId: string,
  status: TestStatus,
  rejectionNote?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (rejectionNote) updates.rejectionNote = rejectionNote;
  await updateDoc(doc(db, 'tests', testId), updates);
}

// ── Fetch tests ───────────────────────────────────────────────────────────────

export async function getTest(testId: string): Promise<Test | null> {
  const snap = await getDoc(doc(db, 'tests', testId));
  if (!snap.exists()) return null;
  return docToTest(snap.id, snap.data() as Record<string, unknown>);
}

// Faculty: get tests created by this faculty member
export async function getFacultyTests(facultyUid: string): Promise<Test[]> {
  try {
    const q = query(
      collection(db, 'tests'),
      where('createdBy', '==', facultyUid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => docToTest(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

// Admin: get tests pending approval
export async function getPendingApprovalTests(): Promise<Test[]> {
  try {
    const q = query(
      collection(db, 'tests'),
      where('status', '==', 'pending_approval'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => docToTest(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

// Student: get tests assigned to this student (faculty_batch)
export async function getAssignedTests(studentUid: string): Promise<Test[]> {
  try {
    const now = new Date().toISOString();
    const q = query(
      collection(db, 'tests'),
      where('type', '==', 'faculty_batch'),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToTest(d.id, d.data() as Record<string, unknown>))
      .filter(t => {
        const assigned = t.assignedTo;
        const inAssigned = assigned === 'all' || (Array.isArray(assigned) && assigned.includes(studentUid));
        const notExpired = !t.endAt || t.endAt > now;
        return inAssigned && notExpired;
      });
  } catch {
    return [];
  }
}

// Student: get approved coaching tests
export async function getCoachingTests(): Promise<Test[]> {
  try {
    const q = query(
      collection(db, 'tests'),
      where('type', '==', 'faculty_coaching'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => docToTest(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

// ── Test Attempts ─────────────────────────────────────────────────────────────

export async function saveTestAttempt(
  attempt: Omit<TestAttempt, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'testAttempts'), {
    ...attempt,
    startedAt:   serverTimestamp(),
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getStudentAttempts(studentUid: string): Promise<TestAttempt[]> {
  try {
    const q = query(
      collection(db, 'testAttempts'),
      where('studentId', '==', studentUid),
      where('status', '==', 'submitted'),
      orderBy('submittedAt', 'desc'),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<TestAttempt, 'id'>),
    }));
  } catch {
    return [];
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
