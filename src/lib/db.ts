import { doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  currentStudent,
  subjectPerformance,
  weeklyProgress,
  heatmapCells,
  weakAreas,
  aiRecommendations,
} from '../mocks/student';

// ── Collections ──────────────────────────────────────────────────────────────
export const Col = {
  users:        'users',
  studentStats: 'studentStats',
  institutes:   'institutes',
  questions:    'questions',
  exams:        'exams',
  attempts:     'examAttempts',
  leaderboard:  'leaderboard',
  notifications:'notifications',
  auditLogs:    'auditLogs',
  meta:         '_meta',
} as const;

// ── Student Dashboard ─────────────────────────────────────────────────────────

export async function getStudentDashboard(uid: string) {
  try {
    if (uid && !uid.startsWith('dev-')) {
      const snap = await getDoc(doc(db, Col.studentStats, uid));
      if (snap.exists()) return snap.data();
    }
  } catch {
    // Firestore unavailable — fall through to mocks
  }

  // Convert mocks to the shape the dashboard renders
  return {
    currentStudent: {
      ...currentStudent,
      examTarget:  'JEE 2025',
      daysToExam:  47,
    },
    metrics: [
      { label: 'Overall Score',   value: '85%',  trend:  3 },
      { label: 'Current Rank',    value: '#42',  trend: -2 },
      { label: 'Practice Streak', value: '14d',  trend:  7 },
      { label: 'Tests Completed', value: '28',   trend:  5 },
    ],
    weeklyProgress: weeklyProgress.map((d, i) => ({
      day:       d.day,
      physics:   d.percent,
      chemistry: Math.max(10, d.percent - 8 + i),
      math:      Math.min(100, d.percent + 4 - i),
    })),
    subjectPerformance: subjectPerformance.map(s => ({
      subject: s.subject,
      pct:     s.percent,
      correct: Math.round(s.percent * 0.5),
    })),
    heatmapCells,
    weakAreas,
    aiRecommendations: aiRecommendations.map(r => ({
      ...r,
      subject: r.title.toLowerCase().includes('newton') ? 'Physics'
             : r.title.toLowerCase().includes('quadratic') ? 'Math'
             : 'Chemistry',
    })),
  };
}

// ── Save / update student stats (called after exam submission) ───────────────
export async function saveStudentStats(uid: string, stats: Record<string, unknown>) {
  await setDoc(doc(db, Col.studentStats, uid), {
    ...stats,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── User ──────────────────────────────────────────────────────────────────────
export async function getUser(uid: string) {
  const snap = await getDoc(doc(db, Col.users, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function listUsers(search = '', role?: string) {
  const snap = await getDocs(collection(db, Col.users));
  let users = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
  if (role && role !== 'All') users = users.filter(u => u['role'] === role.toLowerCase());
  if (search) {
    const q = search.toLowerCase();
    users = users.filter(u =>
      String(u['name']  ?? '').toLowerCase().includes(q) ||
      String(u['email'] ?? '').toLowerCase().includes(q) ||
      String(u['role']  ?? '').toLowerCase().includes(q)
    );
  }
  return users;
}

// ── Institutes ────────────────────────────────────────────────────────────────
export async function listInstitutes(region = 'All', plan = 'All') {
  const snap = await getDocs(collection(db, Col.institutes));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
  if (region !== 'All') list = list.filter(i => i['region'] === region);
  if (plan   !== 'All') list = list.filter(i => i['plan']   === plan);
  return list;
}

// ── Questions ─────────────────────────────────────────────────────────────────
export async function listQuestions(subject = 'All', difficulty = 'All', search = '') {
  const snap = await getDocs(collection(db, Col.questions));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
  if (subject    !== 'All') list = list.filter(q => q['subject']    === subject);
  if (difficulty !== 'All') list = list.filter(q => q['difficulty'] === difficulty);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(q =>
      String(q['prompt']  ?? '').toLowerCase().includes(s) ||
      String(q['chapter'] ?? '').toLowerCase().includes(s)
    );
  }
  return list;
}

// ── Exam Attempts ─────────────────────────────────────────────────────────────
export async function getLatestAttempt(uid: string) {
  try {
    const q = query(
      collection(db, Col.attempts),
      where('userId', '==', uid),
      where('status', '==', 'submitted'),
      orderBy('submittedAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch {
    return null;
  }
}

// ── Stream ────────────────────────────────────────────────────────────────────

export async function saveStudentStream(uid: string, stream: string) {
  await setDoc(doc(db, Col.users, uid), { stream }, { merge: true });
}

export async function getStudentStreamDB(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, Col.users, uid));
    return snap.exists() ? (snap.data().stream ?? null) : null;
  } catch {
    return null;
  }
}

// ── Student Progress ──────────────────────────────────────────────────────────

export interface LastActivity {
  type: 'test' | 'practice';
  title: string;
  score?: number;
  accuracy?: number;
  completedAt: string;
}

export interface TestResult {
  testTitle: string;
  testDate: string;
  subject: string;
  chapter: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracyPct: number;
  score: number;
  timeMinutes: number;
  easyPct: number;
  mediumPct: number;
  hardPct: number;
  topicAccuracy: Array<{ topic: string; pct: number; correct: number; total: number }>;
}

export interface ProgressRecord {
  lastActivity: LastActivity | null;
  completedTests: number;
  streakDays: number;
  nextRecommendation?: string;
  latestTestResult?: TestResult;
}

export async function getStudentProgressData(uid: string): Promise<ProgressRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'studentProgress', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    // Convert Firestore Timestamp → ISO string if needed
    const la = d.lastActivity;
    if (la?.completedAt instanceof Timestamp) {
      la.completedAt = la.completedAt.toDate().toISOString();
    }
    return d as ProgressRecord;
  } catch {
    return null;
  }
}

export async function updateStudentProgress(uid: string, data: Partial<ProgressRecord>) {
  try {
    await setDoc(doc(db, 'studentProgress', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    // silent
  }
}

// ── Parent → Student link ─────────────────────────────────────────────────────

export async function getLinkedStudentData(parentUid: string) {
  try {
    const parentSnap = await getDoc(doc(db, Col.users, parentUid));
    if (!parentSnap.exists()) return null;
    const linkedId: string | undefined = parentSnap.data().linkedStudentId;
    if (!linkedId) return null;
    const stuSnap = await getDoc(doc(db, Col.users, linkedId));
    if (!stuSnap.exists()) return null;
    const d = stuSnap.data();
    const progress = await getStudentProgressData(linkedId);
    return {
      id: stuSnap.id,
      name:        d.name        as string ?? 'Student',
      email:       d.email       as string ?? '',
      stream:      d.stream      as string ?? 'JEE',
      examTarget:  d.examTarget  as string ?? 'JEE 2025',
      score:       d.score       as number ?? 85,
      rank:        d.rank        as number ?? 42,
      attendance:  d.attendance  as number ?? 96,
      progress,
    };
  } catch {
    return null;
  }
}

// ── Faculty → Students ────────────────────────────────────────────────────────

export async function getAssignedStudentIds(facultyUid: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, Col.users, facultyUid));
    return snap.exists() ? ((snap.data().assignedStudents as string[]) ?? []) : [];
  } catch {
    return [];
  }
}

export interface MockStudentProfile {
  id: string;
  name: string;
  email: string;
  stream: string;
  examTarget: string;
  score: number;
  accuracy: number;
  rank: number;
  attendance: number;
  status: string;
  progress: ProgressRecord | null;
}

export async function getMockStudentProfile(studentId: string): Promise<MockStudentProfile | null> {
  try {
    const snap = await getDoc(doc(db, Col.users, studentId));
    if (!snap.exists()) return null;
    const d = snap.data();
    const progress = await getStudentProgressData(studentId);
    return {
      id:         snap.id,
      name:       d.name        as string ?? 'Student',
      email:      d.email       as string ?? '',
      stream:     d.stream      as string ?? 'JEE',
      examTarget: d.examTarget  as string ?? 'JEE 2025',
      score:      d.score       as number ?? 75,
      accuracy:   d.accuracy    as number ?? 72,
      rank:       d.rank        as number ?? 20,
      attendance: d.attendance  as number ?? 90,
      status:     d.status      as string ?? 'Active',
      progress,
    };
  } catch {
    return null;
  }
}

export async function getAssignedStudentsData(facultyUid: string): Promise<MockStudentProfile[]> {
  const ids = await getAssignedStudentIds(facultyUid);
  if (!ids.length) return [];
  const profiles = await Promise.all(ids.map(id => getMockStudentProfile(id)));
  return profiles.filter((p): p is MockStudentProfile => p !== null);
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getUserNotifications(uid: string) {
  try {
    const q = query(
      collection(db, Col.notifications),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}
