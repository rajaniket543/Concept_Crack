// Central question repository (Feature 3 + 5 + 7).
//
// Every question in Concept Crack gets a permanent unique code (CC-Q-2026-00001582)
// plus tracking metadata (origin, uploader, difficulty, subject/chapter/topic,
// verification status). This library owns the real Firestore `questions` collection
// that exams already read from — the faculty Question Bank, PDF/image upload, AI
// generation and manual test builder all go through here.

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  runTransaction, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export const QUESTION_ORIGINS = [
  'Allen',
  'PW',
  'Aakash',
  'Resonance',
  'Faculty Upload',
  'Concept Crack AI',
  'Previous Year Paper',
  'NCERT',
  'Custom',
] as const;

export type QuestionOrigin = (typeof QUESTION_ORIGINS)[number];

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export interface BankQuestion {
  id:                 string;
  code?:              string;
  question:           string;
  options:            { A: string; B: string; C: string; D: string };
  answer:             'A' | 'B' | 'C' | 'D' | null;
  difficulty:         'Easy' | 'Medium' | 'Hard';
  subject:            string;
  chapter:            string;
  topic?:             string;
  origin?:            string;
  uploadedBy?:        string;
  uploadedByName?:    string;
  explanation?:       string;
  verificationStatus?: VerificationStatus;
  originalPdfRef?:    string;   // Feature 5 — source document reference
  isPrivate?:         boolean;  // Feature 5 — "create test only" questions stay out of the shared bank
  createdAt?:         string | null;
}

export interface BankQuestionInput {
  question:           string;
  options:            { A: string; B: string; C: string; D: string };
  answer:             'A' | 'B' | 'C' | 'D';
  difficulty:         'Easy' | 'Medium' | 'Hard';
  subject:            string;
  chapter:            string;
  topic?:             string;
  origin:             QuestionOrigin;
  uploadedBy:         string;
  uploadedByName?:    string;
  explanation?:       string;
  verificationStatus?: VerificationStatus;
  originalPdfRef?:    string;
  isPrivate?:         boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return null;
}

function docToBankQuestion(id: string, d: Record<string, unknown>): BankQuestion {
  const opts = (d.options ?? {}) as Record<string, string>;
  return {
    id,
    code:               (d.code as string) || undefined,
    question:           (d.question as string) ?? '',
    options:            { A: opts.A ?? '', B: opts.B ?? '', C: opts.C ?? '', D: opts.D ?? '' },
    answer:             (d.answer as BankQuestion['answer']) ?? null,
    difficulty:         (d.difficulty as BankQuestion['difficulty']) ?? 'Medium',
    subject:            (d.subject as string) ?? '',
    chapter:            (d.chapter as string) ?? '',
    topic:              (d.topic as string) || undefined,
    origin:             (d.origin as string) || (d.source as string) || undefined,
    uploadedBy:         (d.uploadedBy as string) || undefined,
    uploadedByName:     (d.uploadedByName as string) || undefined,
    explanation:        (d.explanation as string) || undefined,
    verificationStatus: (d.verificationStatus as VerificationStatus) || undefined,
    originalPdfRef:     (d.originalPdfRef as string) || undefined,
    isPrivate:          (d.isPrivate as boolean) ?? false,
    createdAt:          toIso(d.createdAt),
  };
}

// ── Unique code generation ─────────────────────────────────────────────────────

/**
 * Atomically allocate the next global question sequence number and format it as
 * CC-Q-<year>-<8 digits>. Uses a Firestore transaction on _meta/questionCounter
 * so two concurrent uploads never collide.
 */
export async function nextQuestionCode(): Promise<string> {
  const ref = doc(db, '_meta', 'questionCounter');
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? ((snap.data().seq as number) ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { seq: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });
  const year = new Date().getFullYear();
  return `CC-Q-${year}-${String(seq).padStart(8, '0')}`;
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function createBankQuestion(input: BankQuestionInput): Promise<{ id: string; code: string }> {
  const code = await nextQuestionCode();
  const payload: Record<string, unknown> = {
    code,
    question:           input.question,
    options:            input.options,
    answer:             input.answer,
    difficulty:         input.difficulty,
    subject:            input.subject,
    chapter:            input.chapter,
    topic:              input.topic ?? '',
    origin:             input.origin,
    source:             input.origin,   // keep legacy `source` in sync for existing readers
    uploadedBy:         input.uploadedBy,
    uploadedByName:     input.uploadedByName ?? '',
    explanation:        input.explanation ?? '',
    verificationStatus: input.verificationStatus ?? 'unverified',
    isPrivate:          input.isPrivate ?? false,
    createdAt:          serverTimestamp(),
    updatedAt:          serverTimestamp(),
  };
  if (input.originalPdfRef) payload.originalPdfRef = input.originalPdfRef;
  const ref = await addDoc(collection(db, 'questions'), payload);
  return { id: ref.id, code };
}

/** Bulk create (used by PDF/image extraction). Returns created ids + codes. */
export async function createBankQuestions(inputs: BankQuestionInput[]): Promise<Array<{ id: string; code: string }>> {
  const out: Array<{ id: string; code: string }> = [];
  for (const input of inputs) {
    out.push(await createBankQuestion(input));   // sequential so codes stay ordered
  }
  return out;
}

export async function updateBankQuestion(id: string, patch: Partial<BankQuestionInput>): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, 'questions', id), { ...clean, updatedAt: serverTimestamp() });
}

export async function deleteBankQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, 'questions', id));
}

export async function getBankQuestion(id: string): Promise<BankQuestion | null> {
  const snap = await getDoc(doc(db, 'questions', id));
  return snap.exists() ? docToBankQuestion(snap.id, snap.data() as Record<string, unknown>) : null;
}

// ── Listing / search / filters ──────────────────────────────────────────────────

export interface BankFilters {
  subject?:     string;
  chapter?:     string;
  topic?:       string;
  difficulty?:  string;
  origin?:      string;
  uploadedBy?:  string;
  code?:        string;
  search?:      string;
  includePrivate?: boolean;
}

export async function listBankQuestions(filters: BankFilters = {}): Promise<BankQuestion[]> {
  const snap = await getDocs(collection(db, 'questions'));
  let list = snap.docs.map(d => docToBankQuestion(d.id, d.data() as Record<string, unknown>));

  // Private (test-only) questions never appear in the shared repository.
  if (!filters.includePrivate) list = list.filter(q => !q.isPrivate);

  const eq = (a?: string, b?: string) => !b || b === 'All' || (a ?? '') === b;
  list = list.filter(q =>
    eq(q.subject, filters.subject) &&
    eq(q.chapter, filters.chapter) &&
    eq(q.difficulty, filters.difficulty) &&
    eq(q.origin, filters.origin) &&
    eq(q.uploadedBy, filters.uploadedBy),
  );
  if (filters.topic) {
    const t = filters.topic.toLowerCase();
    list = list.filter(q => (q.topic ?? '').toLowerCase().includes(t));
  }
  if (filters.code) {
    const c = filters.code.toLowerCase();
    list = list.filter(q => (q.code ?? '').toLowerCase().includes(c));
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(q =>
      (q.code ?? '').toLowerCase().includes(s) ||
      q.question.toLowerCase().includes(s) ||
      q.chapter.toLowerCase().includes(s) ||
      (q.topic ?? '').toLowerCase().includes(s) ||
      (q.uploadedByName ?? '').toLowerCase().includes(s) ||
      (q.origin ?? '').toLowerCase().includes(s),
    );
  }
  return list.sort((a, b) => (b.code ?? '').localeCompare(a.code ?? '') || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/**
 * Assign codes to any legacy questions that don't have one yet. Returns how many
 * were updated. Safe to run repeatedly (skips questions that already have a code).
 */
export async function backfillQuestionCodes(): Promise<number> {
  const snap = await getDocs(collection(db, 'questions'));
  let count = 0;
  for (const d of snap.docs) {
    if ((d.data() as Record<string, unknown>).code) continue;
    const code = await nextQuestionCode();
    await updateDoc(doc(db, 'questions', d.id), { code, updatedAt: serverTimestamp() });
    count += 1;
  }
  return count;
}
