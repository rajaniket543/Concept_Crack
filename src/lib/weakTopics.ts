import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface TopicStat {
  subject: string;
  chapter: string;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracyPct: number;
  lastAttempt: string; // ISO string
}

export interface WeakTopicsRecord {
  topics: Record<string, TopicStat>; // key = `${subject}::${chapter}`
  updatedAt?: string;
}

export async function getWeakTopics(uid: string): Promise<WeakTopicsRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'studentWeakTopics', uid));
    if (!snap.exists()) return null;
    return snap.data() as WeakTopicsRecord;
  } catch {
    return null;
  }
}

// Called after every test submission with per-chapter results
export async function updateWeakTopics(
  uid: string,
  results: Array<{ subject: string; chapter: string; correct: number; incorrect: number }>
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'studentWeakTopics', uid));
    const existing: WeakTopicsRecord = snap.exists()
      ? (snap.data() as WeakTopicsRecord)
      : { topics: {} };

    const now = new Date().toISOString();
    for (const r of results) {
      const key = `${r.subject}::${r.chapter}`;
      const prev = existing.topics[key] ?? {
        subject: r.subject, chapter: r.chapter,
        attempts: 0, correct: 0, incorrect: 0, accuracyPct: 0, lastAttempt: now,
      };
      const newCorrect   = prev.correct   + r.correct;
      const newIncorrect = prev.incorrect + r.incorrect;
      const newAttempts  = prev.attempts  + r.correct + r.incorrect;
      const newAccuracy  = newAttempts > 0 ? Math.round((newCorrect / newAttempts) * 100) : 0;

      existing.topics[key] = {
        subject:     r.subject,
        chapter:     r.chapter,
        attempts:    newAttempts,
        correct:     newCorrect,
        incorrect:   newIncorrect,
        accuracyPct: newAccuracy,
        lastAttempt: now,
      };
    }

    await setDoc(
      doc(db, 'studentWeakTopics', uid),
      { topics: existing.topics, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch {
    // silent — never block exam flow
  }
}

// Returns topics sorted weakest first, optionally filtered by subject
export function rankWeakTopics(
  record: WeakTopicsRecord,
  subject?: string
): TopicStat[] {
  return Object.values(record.topics)
    .filter(t => !subject || t.subject === subject)
    .sort((a, b) => a.accuracyPct - b.accuracyPct);
}
