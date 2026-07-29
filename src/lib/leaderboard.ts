import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getStudentXP } from './xp';
import type { StudentStream } from './stream';

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  stream: StudentStream | null;
  points: number;
  previousPoints: number;
  streakDays: number;
  updatedAt: string;
}

const COLLECTION = 'leaderboard';

// Real, traceable ranking points — same formula already used for the XP pill
// in the sidebar (correct answers + streak + study time), not a separate
// fabricated "leaderboard score". Doc ID is the student's own uid so the
// security rule can allow a student to write only their own row.
export async function upsertMyLeaderboardEntry(
  uid: string, name: string, stream: StudentStream | null
): Promise<LeaderboardEntry> {
  const [xp, prevSnap] = await Promise.all([
    getStudentXP(uid),
    getDoc(doc(db, COLLECTION, uid)),
  ]);
  const previousPoints = prevSnap.exists() ? (prevSnap.data().points as number) ?? 0 : 0;
  const entry: LeaderboardEntry = {
    studentId: uid,
    name,
    stream,
    points: xp.total,
    previousPoints,
    streakDays: xp.streakDays,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, COLLECTION, uid), entry);
  return entry;
}

// No orderBy/where in the query — same convention as src/lib/tests.ts (avoids
// a composite-index deploy step); filtered and sorted entirely client-side.
export async function listLeaderboard(stream: StudentStream | null): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  const all = snap.docs.map(d => d.data() as LeaderboardEntry);
  const scoped = stream ? all.filter(e => e.stream === stream) : all;
  return scoped.sort((a, b) => b.points - a.points);
}
