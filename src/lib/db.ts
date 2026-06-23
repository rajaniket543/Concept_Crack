import { doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
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
