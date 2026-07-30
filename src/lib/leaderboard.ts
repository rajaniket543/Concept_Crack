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
  /** True only for the generated placeholder rows used to fill out the board
   *  before enough real peers exist — never set on a real student's entry,
   *  and never a specific identifiable person (generic representative names
   *  only). Not rendered any differently in the UI per product decision —
   *  kept on the object purely so this stays traceable in code. */
  isSample?: boolean;
}

// Generic, representative Indian names (not tied to any real, identifiable
// student) — placeholder rows only, used to fill out the board until enough
// real students have their own real entry.
const SAMPLE_NAMES = ['Aarav Sharma', 'Priya Patel', 'Rohan Mehta', 'Ananya Iyer'];

/** Generates placeholder rows to fill out the board while there aren't yet
 *  enough real peers. Deterministic (not random) so the board doesn't
 *  reshuffle on every reload; points are round, illustrative numbers. */
export function sampleLeaderboardEntries(stream: StudentStream | null, count: number): LeaderboardEntry[] {
  return SAMPLE_NAMES.slice(0, count).map((name, i) => ({
    studentId: `sample-${i}`,
    name,
    stream,
    points: 2840 - i * 230,
    previousPoints: 2840 - i * 230,
    streakDays: 12 - i * 2,
    updatedAt: new Date().toISOString(),
    isSample: true,
  }));
}

const COLLECTION = 'leaderboard';

// Real, traceable ranking points — same formula already used for the XP pill
// in the sidebar (correct answers + streak + study time), not a separate
// fabricated "leaderboard score". Doc ID is the student's own uid so the
// security rule can allow a student to write only their own row.
export async function upsertMyLeaderboardEntry(
  uid: string, name: string, stream: StudentStream | null
): Promise<LeaderboardEntry> {
  const entry = await buildMyLeaderboardEntry(uid, name, stream);
  await setDoc(doc(db, COLLECTION, uid), entry);
  return entry;
}

/** This student's own real entry, computed without writing anything. Kept
 *  separate from the upsert so the page can still show your own standing when
 *  the shared-board write is unavailable (e.g. the /leaderboard rule hasn't
 *  been published yet) instead of rendering an empty board. */
export async function buildMyLeaderboardEntry(
  uid: string, name: string, stream: StudentStream | null
): Promise<LeaderboardEntry> {
  const [xp, prevSnap] = await Promise.all([
    getStudentXP(uid),
    getDoc(doc(db, COLLECTION, uid)).catch(() => null),
  ]);
  const previousPoints = prevSnap?.exists() ? (prevSnap.data().points as number) ?? 0 : 0;
  return {
    studentId: uid,
    name,
    stream,
    points: xp.total,
    previousPoints,
    streakDays: xp.streakDays,
    updatedAt: new Date().toISOString(),
  };
}

// No orderBy/where in the query — same convention as src/lib/tests.ts (avoids
// a composite-index deploy step); filtered and sorted entirely client-side.
export async function listLeaderboard(stream: StudentStream | null): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  const all = snap.docs.map(d => d.data() as LeaderboardEntry);
  const scoped = stream ? all.filter(e => e.stream === stream) : all;
  return scoped.sort((a, b) => b.points - a.points);
}
