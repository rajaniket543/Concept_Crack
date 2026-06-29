import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, collection, addDoc, Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BattleStatus = 'lobby' | 'active' | 'completed';

export interface BattleParticipant {
  uid: string;
  name: string;
  initials: string;
  status: 'joined' | 'ready' | 'completed';
  score: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracyPct: number;
  timeTaken: number;
  answers: Record<string, string>;
}

export interface Battle {
  id: string;
  hostId: string;
  status: BattleStatus;
  subjects: string[];
  chapters: string[];
  difficulty: string;
  questionCount: number;
  durationSeconds: number;
  questionIds: string[];
  participants: Record<string, BattleParticipant>;
  startAt: string | null;
  createdAt: string;
}

// ── Create battle ─────────────────────────────────────────────────────────────

export async function createBattle(
  hostId: string,
  hostName: string,
): Promise<string> {
  const initials = hostName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const ref = await addDoc(collection(db, 'battles'), {
    hostId,
    status: 'lobby',
    subjects: [],
    chapters: [],
    difficulty: 'Mixed',
    questionCount: 20,
    durationSeconds: 1800,
    questionIds: [],
    participants: {
      [hostId]: {
        uid: hostId, name: hostName, initials,
        status: 'joined', score: 0,
        correctCount: 0, incorrectCount: 0, skippedCount: 0,
        accuracyPct: 0, timeTaken: 0, answers: {},
      },
    },
    startAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Join battle ───────────────────────────────────────────────────────────────

export async function joinBattle(
  battleId: string,
  uid: string,
  name: string,
): Promise<Battle | null> {
  const ref  = doc(db, 'battles', battleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<Battle, 'id'>;
  if (data.status !== 'lobby') return null;

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  await updateDoc(ref, {
    [`participants.${uid}`]: {
      uid, name, initials,
      status: 'joined', score: 0,
      correctCount: 0, incorrectCount: 0, skippedCount: 0,
      accuracyPct: 0, timeTaken: 0, answers: {},
    },
  });
  return { id: snap.id, ...data };
}

// ── Configure battle (host only) ──────────────────────────────────────────────

export async function configureBattle(
  battleId: string,
  config: {
    subjects: string[];
    chapters: string[];
    difficulty: string;
    questionCount: number;
    durationSeconds: number;
    questionIds: string[];
  }
): Promise<void> {
  await updateDoc(doc(db, 'battles', battleId), config);
}

// ── Start battle ──────────────────────────────────────────────────────────────

export async function startBattle(battleId: string): Promise<void> {
  await updateDoc(doc(db, 'battles', battleId), {
    status: 'active',
    startAt: new Date().toISOString(),
  });
}

// ── Submit participant result ──────────────────────────────────────────────────

export async function submitBattleResult(
  battleId: string,
  uid: string,
  result: {
    answers: Record<string, string>;
    score: number;
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    accuracyPct: number;
    timeTaken: number;
  }
): Promise<void> {
  const ref = doc(db, 'battles', battleId);
  await updateDoc(ref, {
    [`participants.${uid}.answers`]:       result.answers,
    [`participants.${uid}.score`]:         result.score,
    [`participants.${uid}.correctCount`]:  result.correctCount,
    [`participants.${uid}.incorrectCount`]:result.incorrectCount,
    [`participants.${uid}.skippedCount`]:  result.skippedCount,
    [`participants.${uid}.accuracyPct`]:   result.accuracyPct,
    [`participants.${uid}.timeTaken`]:     result.timeTaken,
    [`participants.${uid}.status`]:        'completed',
  });

  // If all participants completed, close the battle
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const battle = snap.data() as Omit<Battle, 'id'>;
    const allDone = Object.values(battle.participants).every(p => p.status === 'completed');
    if (allDone) {
      await updateDoc(ref, { status: 'completed' });
    }
  }
}

// ── Real-time listener ────────────────────────────────────────────────────────

export function subscribeToBattle(
  battleId: string,
  callback: (battle: Battle) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'battles', battleId), snap => {
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      const startAt = data.startAt instanceof Timestamp
        ? data.startAt.toDate().toISOString()
        : (data.startAt as string | null) ?? null;
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt as string) ?? '';
      callback({ id: snap.id, ...data, startAt, createdAt } as Battle);
    }
  });
}

export async function getBattle(battleId: string): Promise<Battle | null> {
  const snap = await getDoc(doc(db, 'battles', battleId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const startAt = data.startAt instanceof Timestamp
    ? data.startAt.toDate().toISOString()
    : (data.startAt as string | null) ?? null;
  return { id: snap.id, ...data, startAt } as Battle;
}
