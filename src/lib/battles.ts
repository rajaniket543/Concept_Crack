import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, collection, addDoc, getDocs,
  query, where, Timestamp, arrayUnion, arrayRemove,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BattleStatus = 'lobby' | 'active' | 'completed';

export interface BattleParticipant {
  uid:           string;
  name:          string;
  initials:      string;
  status:        'joined' | 'ready' | 'completed';
  score:         number;
  correctCount:  number;
  incorrectCount:number;
  skippedCount:  number;
  accuracyPct:   number;
  timeTaken:     number;
  answers:       Record<string, string>;
}

export interface Battle {
  id:              string;
  hostId:          string;
  status:          BattleStatus;
  subjects:        string[];
  chapters:        string[];
  difficulty:      string;
  questionCount:   number;
  durationSeconds: number;
  questionIds:     string[];
  participants:    Record<string, BattleParticipant>;
  invitedStudents: string[];       // uids of invited but not-yet-joined students
  startAt:         string | null;
  createdAt:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function snapToBattle(id: string, data: Record<string, unknown>): Battle {
  const toStr = (v: unknown) => v instanceof Timestamp ? v.toDate().toISOString() : (v as string | null) ?? null;
  return {
    id,
    hostId:          data.hostId          as string,
    status:          data.status          as BattleStatus,
    subjects:        (data.subjects       as string[]) ?? [],
    chapters:        (data.chapters       as string[]) ?? [],
    difficulty:      (data.difficulty     as string) ?? 'Mixed',
    questionCount:   (data.questionCount  as number) ?? 0,
    durationSeconds: (data.durationSeconds as number) ?? 1800,
    questionIds:     (data.questionIds    as string[]) ?? [],
    participants:    (data.participants   as Record<string, BattleParticipant>) ?? {},
    invitedStudents: (data.invitedStudents as string[]) ?? [],
    startAt:         toStr(data.startAt),
    createdAt:       toStr(data.createdAt) ?? '',
  };
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createBattle(hostId: string, hostName: string): Promise<string> {
  const initials = hostName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const ref = await addDoc(collection(db, 'battles'), {
    hostId,
    status:          'lobby',
    subjects:        [],
    chapters:        [],
    difficulty:      'Mixed',
    questionCount:   20,
    durationSeconds: 1800,
    questionIds:     [],
    invitedStudents: [],
    participants: {
      [hostId]: {
        uid: hostId, name: hostName, initials,
        status: 'joined', score: 0,
        correctCount: 0, incorrectCount: 0, skippedCount: 0,
        accuracyPct: 0, timeTaken: 0, answers: {},
      },
    },
    startAt:  null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Join ──────────────────────────────────────────────────────────────────────

export async function joinBattle(battleId: string, uid: string, name: string): Promise<Battle | null> {
  const ref  = doc(db, 'battles', battleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  if (data.status !== 'lobby') return null;

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  await updateDoc(ref, {
    [`participants.${uid}`]: {
      uid, name, initials,
      status: 'joined', score: 0,
      correctCount: 0, incorrectCount: 0, skippedCount: 0,
      accuracyPct: 0, timeTaken: 0, answers: {},
    },
    invitedStudents: arrayRemove(uid),
  });
  return snapToBattle(snap.id, data);
}

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteStudentToBattle(battleId: string, inviteUid: string): Promise<void> {
  await updateDoc(doc(db, 'battles', battleId), {
    invitedStudents: arrayUnion(inviteUid),
  });
}

export async function declineBattleInvite(battleId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'battles', battleId), {
    invitedStudents: arrayRemove(uid),
  });
}

export async function getPendingBattleInvites(uid: string): Promise<Battle[]> {
  try {
    // Single where clause only — composite index not needed; filter status client-side
    const q = query(
      collection(db, 'battles'),
      where('invitedStudents', 'array-contains', uid),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => snapToBattle(d.id, d.data() as Record<string, unknown>))
      .filter(b => b.status === 'lobby');
  } catch {
    return [];
  }
}

// ── Configure ─────────────────────────────────────────────────────────────────

export async function configureBattle(
  battleId: string,
  config: {
    subjects:        string[];
    chapters:        string[];
    difficulty:      string;
    questionCount:   number;
    durationSeconds: number;
    questionIds:     string[];
  }
): Promise<void> {
  await updateDoc(doc(db, 'battles', battleId), config);
}

// ── Start ─────────────────────────────────────────────────────────────────────

export async function startBattle(battleId: string): Promise<void> {
  await updateDoc(doc(db, 'battles', battleId), {
    status:  'active',
    startAt: new Date().toISOString(),
  });
}

// ── Submit result ─────────────────────────────────────────────────────────────

export async function submitBattleResult(
  battleId: string,
  uid: string,
  result: {
    answers:       Record<string, string>;
    score:         number;
    correctCount:  number;
    incorrectCount:number;
    skippedCount:  number;
    accuracyPct:   number;
    timeTaken:     number;
  }
): Promise<void> {
  const ref = doc(db, 'battles', battleId);
  await updateDoc(ref, {
    [`participants.${uid}.answers`]:        result.answers,
    [`participants.${uid}.score`]:          result.score,
    [`participants.${uid}.correctCount`]:   result.correctCount,
    [`participants.${uid}.incorrectCount`]: result.incorrectCount,
    [`participants.${uid}.skippedCount`]:   result.skippedCount,
    [`participants.${uid}.accuracyPct`]:    result.accuracyPct,
    [`participants.${uid}.timeTaken`]:      result.timeTaken,
    [`participants.${uid}.status`]:         'completed',
  });
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const battle = snap.data() as Omit<Battle, 'id'>;
    const allDone = Object.values(battle.participants).every(p => p.status === 'completed');
    if (allDone) await updateDoc(ref, { status: 'completed' });
  }
}

// ── Real-time listener ────────────────────────────────────────────────────────

export function subscribeToBattle(battleId: string, callback: (battle: Battle) => void): Unsubscribe {
  return onSnapshot(doc(db, 'battles', battleId), snap => {
    if (snap.exists()) callback(snapToBattle(snap.id, snap.data() as Record<string, unknown>));
  });
}

export async function getBattle(battleId: string): Promise<Battle | null> {
  const snap = await getDoc(doc(db, 'battles', battleId));
  if (!snap.exists()) return null;
  return snapToBattle(snap.id, snap.data() as Record<string, unknown>);
}

// ── Search students (for invite) ──────────────────────────────────────────────

export interface StudentSearchResult {
  uid:  string;
  name: string;
  email:string;
}

export async function searchStudents(term: string): Promise<StudentSearchResult[]> {
  if (!term.trim()) return [];
  try {
    const trimmed = term.trim();
    const snap = await getDocs(collection(db, 'users'));
    const lower = trimmed.toLowerCase();
    return snap.docs
      .filter(d => {
        const data = d.data();
        return data.role === 'student' &&
          (String(data.name ?? '').toLowerCase().includes(lower) ||
           String(data.email ?? '').toLowerCase().includes(lower));
      })
      .slice(0, 8)
      .map(d => ({
        uid:   d.id,
        name:  (d.data().name  as string) ?? '',
        email: (d.data().email as string) ?? '',
      }));
  } catch {
    return [];
  }
}
