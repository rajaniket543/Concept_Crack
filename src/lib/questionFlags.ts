import { doc, getDoc, setDoc, getDocs, collection, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export type FlagStatus = 'open' | 'resolved';

export const FLAG_REASONS = [
  'Wrong answer',
  'Incorrect solution',
  'Typo',
  'Duplicate question',
  'Outdated syllabus',
  'Question unclear',
  'Wrong difficulty',
  'Image issue',
  'Other',
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];

export interface QuestionFlag {
  id: string;
  questionId: string;
  subject: string;
  chapter: string;
  topic?: string;
  questionText: string;
  reason: FlagReason;
  comment?: string;
  challengeId?: string;
  flaggedBy: string;
  /** Same value as `flaggedBy` — kept as a second field purely so the schema
   *  reads consistently with other collections that use `studentId`. */
  studentId: string;
  flaggedByName: string;
  status: FlagStatus;
  resolution?: 'approved' | 'rejected';
  resolutionNote?: string;
  createdAt: string;
}

const COLLECTION = 'questionFlags';

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return '';
}

function isFlagReason(v: unknown): v is FlagReason {
  return typeof v === 'string' && (FLAG_REASONS as readonly string[]).includes(v);
}

function docToFlag(id: string, d: Record<string, unknown>): QuestionFlag {
  const flaggedBy = (d.flaggedBy as string) ?? '';
  return {
    id,
    questionId:     (d.questionId as string) ?? '',
    subject:        (d.subject as string) ?? '',
    chapter:        (d.chapter as string) ?? '',
    topic:          (d.topic as string) || undefined,
    questionText:   (d.questionText as string) ?? '',
    // Legacy dead-code-era docs (if any) had a free-text reason — fall back
    // to 'Other' rather than reject if it doesn't match the current enum.
    reason:         isFlagReason(d.reason) ? d.reason : 'Other',
    comment:        (d.comment as string) || undefined,
    challengeId:    (d.challengeId as string) || undefined,
    flaggedBy,
    studentId:      (d.studentId as string) || flaggedBy,
    flaggedByName:  (d.flaggedByName as string) ?? 'A student',
    status:         (d.status as FlagStatus) ?? 'open',
    resolution:     (d.resolution as QuestionFlag['resolution']) || undefined,
    resolutionNote: (d.resolutionNote as string) || undefined,
    createdAt:      toIso(d.createdAt),
  };
}

/** A student reporting a question they think is wrong (bad answer key, typo,
 *  mismatched subject, unreadable diagram, etc.) — surfaces on the faculty
 *  Reported Questions page so someone can edit/replace/delete the real
 *  question. Doc ID is deterministic (`${questionId}_${flaggedBy}`) so the
 *  same student can never report the same question twice — enforced both
 *  here (pre-check) and at the rules layer (create requires the ID to match
 *  and the doc to not already exist). */
export async function flagQuestion(input: {
  questionId: string; subject: string; chapter: string; topic?: string; questionText: string;
  reason: FlagReason; comment?: string; challengeId?: string;
  flaggedBy: string; flaggedByName: string;
}): Promise<void> {
  const id = `${input.questionId}_${input.flaggedBy}`;
  const ref = doc(db, COLLECTION, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error('ALREADY_REPORTED');
  }
  await setDoc(ref, {
    questionId:    input.questionId,
    subject:       input.subject,
    chapter:       input.chapter,
    topic:         input.topic ?? '',
    questionText:  input.questionText,
    reason:        input.reason,
    comment:       input.comment ?? '',
    challengeId:   input.challengeId ?? '',
    flaggedBy:     input.flaggedBy,
    studentId:     input.flaggedBy,
    flaggedByName: input.flaggedByName,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export async function listOpenQuestionFlags(): Promise<QuestionFlag[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map(d => docToFlag(d.id, d.data()))
    .filter(f => f.status === 'open')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllQuestionFlags(): Promise<QuestionFlag[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map(d => docToFlag(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function resolveQuestionFlag(id: string, resolution: 'approved' | 'rejected' = 'approved', note?: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'resolved',
    resolution,
    resolutionNote: note ?? '',
    resolvedAt: serverTimestamp(),
  });
}
