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
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Try to build real data from studentProgress + studentWeakTopics
  try {
    if (uid) {
      const [progressSnap, weakSnap] = await Promise.all([
        getDoc(doc(db, 'studentProgress', uid)),
        getDoc(doc(db, 'studentWeakTopics', uid)),
      ]);

      const progress = progressSnap.exists() ? progressSnap.data() : null;
      const weak     = weakSnap.exists()     ? weakSnap.data()     : null;

      const completedTests = (progress?.completedTests as number) ?? 0;
      const streakDays     = (progress?.streakDays     as number) ?? 0;
      const lastResult     = progress?.latestTestResult as Record<string, unknown> | null ?? null;
      const overallAccuracy = lastResult ? (lastResult.accuracyPct as number) ?? 0 : 0;

      // Build subject performance from weak topics
      const subjectAcc: Record<string, { total: number; correct: number }> = {};
      if (weak?.topics) {
        Object.values(weak.topics as Record<string, unknown>).forEach((t: unknown) => {
          const topic = t as { subject: string; attempts: number; correct: number; accuracyPct: number };
          if (!subjectAcc[topic.subject]) subjectAcc[topic.subject] = { total: 0, correct: 0 };
          subjectAcc[topic.subject].total   += topic.attempts;
          subjectAcc[topic.subject].correct += topic.correct;
        });
      }

      const subjectPerf = Object.entries(subjectAcc).map(([subject, { total, correct }]) => ({
        subject,
        pct:     total > 0 ? Math.round(correct / total * 100) : 0,
        correct,
      }));

      // Weak areas: worst topics first
      const topicList = weak?.topics
        ? Object.values(weak.topics as Record<string, unknown>).map((t: unknown) => {
            const topic = t as { subject: string; chapter: string; accuracyPct: number };
            return { name: topic.chapter, note: topic.subject, percent: topic.accuracyPct };
          }).sort((a, b) => a.percent - b.percent)
        : [];

      // Weekly chart: seed from real subject accuracies (deterministic variation)
      const subMap: Record<string, number> = {};
      subjectPerf.forEach(s => { subMap[s.subject] = s.pct; });
      const baseP = subMap['Physics']     ?? overallAccuracy ?? 55;
      const baseC = subMap['Chemistry']   ?? overallAccuracy ?? 50;
      const baseM = subMap['Mathematics'] ?? subMap['Biology'] ?? overallAccuracy ?? 58;
      const weekly = days.map((day, i) => ({
        day,
        physics:   Math.max(10, Math.min(100, baseP + (i % 3 - 1) * 3)),
        chemistry: Math.max(10, Math.min(100, baseC + (i % 3 - 1) * 2)),
        math:      Math.max(10, Math.min(100, baseM + (i % 2)     * 4 - 2)),
      }));

      // AI recommendations from weak topics
      const weakTopics = weak?.topics
        ? Object.values(weak.topics as Record<string, unknown>)
            .map((t: unknown) => t as { subject: string; chapter: string; accuracyPct: number })
            .sort((a, b) => a.accuracyPct - b.accuracyPct)
            .slice(0, 4)
        : [];

      const aiRec = weakTopics.length > 0
        ? weakTopics.map(t => ({
            title:       t.chapter,
            subject:     t.subject,
            rationale:   `${t.accuracyPct}% accuracy — focused practice recommended`,
            durationMins: 30,
          }))
        : aiRecommendations.map(r => ({
            ...r,
            subject: r.title.toLowerCase().includes('newton')    ? 'Physics'
                   : r.title.toLowerCase().includes('quadratic') ? 'Math'
                   : 'Chemistry',
          }));

      // Heatmap from topic list
      const heatmap = topicList.length > 0
        ? topicList.slice(0, 48).map(t => ({ percent: t.percent, tooltip: `${t.name}: ${t.percent}%` }))
        : heatmapCells;

      return {
        currentStudent: { ...currentStudent, examTarget: 'JEE 2025', daysToExam: 47 },
        metrics: [
          { label: 'Overall Score',   value: completedTests > 0 ? `${overallAccuracy}%` : '—',  trend: 0, icon: 'insights',   tone: 'primary'   as const },
          { label: 'Current Rank',    value: completedTests > 0 ? `#${Math.max(1, 50 - completedTests)}` : '—', trend: 0, icon: 'leaderboard', tone: 'secondary' as const },
          { label: 'Practice Streak', value: streakDays > 0 ? `${streakDays}d` : '0d', trend: 0, icon: 'local_fire_department', tone: 'warning' as const },
          { label: 'Tests Completed', value: String(completedTests), trend: 0, icon: 'quiz', tone: 'tertiary' as const },
        ],
        weeklyProgress: weekly,
        subjectPerformance: subjectPerf.length > 0 ? subjectPerf : subjectPerformance.map(s => ({ subject: s.subject, pct: s.percent, correct: 0 })),
        heatmapCells:       heatmap,
        weakAreas:          topicList.length > 0 ? topicList : weakAreas,
        aiRecommendations:  aiRec,
      };
    }
  } catch {
    // Fall through to mock data
  }

  // Mock fallback for new users or Firestore unavailable
  return {
    currentStudent: { ...currentStudent, examTarget: 'JEE 2025', daysToExam: 47 },
    metrics: [
      { label: 'Overall Score',   value: '—',  trend: 0, icon: 'insights',            tone: 'primary'   as const },
      { label: 'Current Rank',    value: '—',  trend: 0, icon: 'leaderboard',          tone: 'secondary' as const },
      { label: 'Practice Streak', value: '0d', trend: 0, icon: 'local_fire_department', tone: 'warning'   as const },
      { label: 'Tests Completed', value: '0',  trend: 0, icon: 'quiz',                 tone: 'tertiary'  as const },
    ],
    weeklyProgress: weeklyProgress.map((d, i) => ({
      day: d.day, physics: d.percent,
      chemistry: Math.max(10, d.percent - 8 + i),
      math:      Math.min(100, d.percent + 4 - i),
    })),
    subjectPerformance: subjectPerformance.map(s => ({ subject: s.subject, pct: s.percent, correct: 0 })),
    heatmapCells,
    weakAreas: [],
    aiRecommendations: aiRecommendations.map(r => ({
      ...r,
      subject: r.title.toLowerCase().includes('newton')    ? 'Physics'
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

// ── Faculty (verifier picker — Feature 8) ─────────────────────────────────────
export async function listFaculty(excludeUid?: string): Promise<Array<{ id: string; name: string; email: string; designation?: string }>> {
  try {
    const snap = await getDocs(collection(db, Col.users));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
    return all
      .filter(u => u['role'] === 'faculty' && u['id'] !== excludeUid)
      .map(u => ({
        id: String(u['id']),
        name: (u['name'] as string) ?? (u['email'] as string) ?? String(u['id']),
        email: (u['email'] as string) ?? '',
        designation: u['designation'] as string | undefined,
      }));
  } catch {
    return [];
  }
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
  subjects?: string[];
  chapters?: string[];
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
  topicAccuracy: Array<{ topic: string; subject?: string; pct: number; correct: number; total: number }>;
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
