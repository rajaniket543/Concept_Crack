import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export type QuestionHistoryAction = 'approved' | 'edited' | 'replaced' | 'deleted' | 'report_rejected';

export interface QuestionHistoryEntry {
  id: string;
  questionId: string;
  action: QuestionHistoryAction;
  actorId: string;
  actorName: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  replacedWithQuestionId?: string;
  affectedTestIds?: string[];
  note?: string;
  createdAt: string;
}

const COLLECTION = 'questionHistory';

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return '';
}

function docToEntry(id: string, d: Record<string, unknown>): QuestionHistoryEntry {
  return {
    id,
    questionId:             (d.questionId as string) ?? '',
    action:                 (d.action as QuestionHistoryAction) ?? 'edited',
    actorId:                (d.actorId as string) ?? '',
    actorName:              (d.actorName as string) ?? 'Faculty',
    before:                 (d.before as Record<string, unknown>) || undefined,
    after:                  (d.after as Record<string, unknown>) || undefined,
    replacedWithQuestionId: (d.replacedWithQuestionId as string) || undefined,
    affectedTestIds:        (d.affectedTestIds as string[]) || undefined,
    note:                   (d.note as string) || undefined,
    createdAt:              toIso(d.createdAt),
  };
}

/** Append-only audit trail for every faculty/admin action taken on a bank
 *  question via the Reported Questions review flow — never mutated. */
export async function logQuestionHistory(entry: Omit<QuestionHistoryEntry, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

export async function getQuestionHistory(questionId: string): Promise<QuestionHistoryEntry[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('questionId', '==', questionId)));
  return snap.docs
    .map(d => docToEntry(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
