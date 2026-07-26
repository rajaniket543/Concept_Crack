import { collection, query, where, getDocs, limit, documentId } from 'firebase/firestore';
import { db } from './firebase';

export interface ChapterInfo {
  id: string;
  subject: string;
  chapter: string;
  stream: string;
  questionCount: number;
}

export type QuestionType = 'single' | 'multiple' | 'numeric';

/** A body segment for questions whose statement isn't one paragraph + one
 *  optional image — e.g. "text, then a figure, then more text" (PYQ papers:
 *  "Consider the following reactions: [scheme] Which will not produce X?").
 *  Only set when the body genuinely needs more than prompt+imageUrl; when
 *  absent, renderers fall back to the plain prompt/imageUrl fields. */
export type BodyBlock =
  | { type: 'text'; content: string }
  | { type: 'image'; imageUrl: string };

export interface ExamQuestion {
  id: string;
  prompt: string;
  /** imageUrl set on an option means that option is a drawn diagram/structure
   *  rather than text (common in organic chemistry "identify the product" and
   *  physics "which plot" questions) — text is "" in that case. */
  options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string; imageUrl?: string }>;
  /** 'single' = one correct MCQ (default), 'multiple' = one-or-more correct,
   *  'numeric' = integer/decimal answer with no options (JEE Advanced patterns). */
  questionType: QuestionType;
  difficulty: string;
  section: string;
  answer: string | null;
  subject?: string;
  chapter?: string;
  imageUrl?: string;
  bodyBlocks?: BodyBlock[];
}

/** A stored question with no questionType is a plain single-answer MCQ. */
function readQuestionType(d: Record<string, unknown>): QuestionType {
  const t = d.questionType as string | undefined;
  return t === 'multiple' || t === 'numeric' ? t : 'single';
}

/** Builds the options array, attaching a per-option image URL when the
 *  question doc has one (options.optionImages.{A,B,C,D}) for that letter. */
function readOptions(d: Record<string, unknown>, questionType: QuestionType): Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string; imageUrl?: string }> {
  if (questionType === 'numeric') return [];
  const opts = (d.options ?? {}) as Record<string, string>;
  const optionImages = (d.optionImages ?? {}) as Record<string, string>;
  return (['A', 'B', 'C', 'D'] as const).map(k => ({
    key: k,
    text: opts[k] ?? '',
    imageUrl: optionImages[k] || undefined,
  }));
}

export async function getChaptersForSubject(subject: string): Promise<ChapterInfo[]> {
  const q = query(
    collection(db, 'chapters'),
    where('subject', '==', subject)
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<ChapterInfo, 'id'>),
  }));
  return results.sort((a, b) => a.chapter.localeCompare(b.chapter));
}

export async function getQuestionsByIds(ids: string[]): Promise<ExamQuestion[]> {
  if (ids.length === 0) return [];
  const chunkSize = 30;
  const results: ExamQuestion[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const q = query(collection(db, 'questions'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach(doc => {
      const d = doc.data();
      const questionType = readQuestionType(d);
      results.push({
        id: doc.id,
        prompt: (d.question as string) ?? '',
        options: readOptions(d, questionType),
        questionType,
        difficulty: (d.difficulty as string) ?? 'Medium',
        section: (d.chapter as string) ?? '',
        answer: (d.answer as string | null) ?? null,
        subject: (d.subject as string) || undefined,
        chapter: (d.chapter as string) || undefined,
        imageUrl: (d.imageUrl as string) || undefined,
        bodyBlocks: (d.bodyBlocks as BodyBlock[]) || undefined,
      });
    });
  }
  // restore original order
  const byId = new Map(results.map(q => [q.id, q]));
  return ids.map(id => byId.get(id)).filter(Boolean) as ExamQuestion[];
}

// Normalised fingerprint of a question's text — used to keep near-identical
// questions (repeated uploads, same stem) from appearing twice in one test (5h).
function questionFingerprint(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w ]/g, '').trim();
}

/** Remove duplicate/same-text questions, keeping the first occurrence. */
export function dedupeQuestions(list: ExamQuestion[]): ExamQuestion[] {
  const seen = new Set<string>();
  return list.filter(q => {
    const fp = questionFingerprint(q.prompt);
    if (!fp || seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

export async function getQuestionsForCustomTest(config: {
  subject: string;
  chapters: string[];
  difficulty: string;
  count: number;
  /** 'main' = single-answer only (default), 'advanced' = multiple/numeric only,
   *  'mixed' = any type. */
  level?: 'main' | 'advanced' | 'mixed';
}): Promise<{ questions: ExamQuestion[]; questionIds: string[] }> {
  const { subject, chapters, difficulty, count, level = 'main' } = config;
  const perChapter = Math.ceil((count * 2) / chapters.length);
  const all: ExamQuestion[] = [];

  await Promise.all(chapters.map(async chapter => {
    const constraints = [
      where('subject', '==', subject),
      where('chapter', '==', chapter),
      ...(difficulty !== 'Mixed' ? [where('difficulty', '==', difficulty)] : []),
      limit(perChapter),
    ];
    const q = query(collection(db, 'questions'), ...constraints);
    const snap = await getDocs(q);
    snap.docs.forEach(doc => {
      const d = doc.data();
      // Defensive subject check so mislabelled documents can never leak another
      // subject's questions into this paper (3g).
      if (((d.subject as string) ?? '').trim() !== subject.trim()) return;
      const questionType = readQuestionType(d);
      // Level filter: Main = single only, Advanced = multiple/numeric only.
      if (level === 'main' && questionType !== 'single') return;
      if (level === 'advanced' && questionType === 'single') return;
      all.push({
        id: doc.id,
        prompt: (d.question as string) ?? '',
        options: readOptions(d, questionType),
        questionType,
        difficulty: (d.difficulty as string) ?? 'Medium',
        section: chapter,
        answer: (d.answer as string | null) ?? null,
        subject,
        chapter,
        imageUrl: (d.imageUrl as string) || undefined,
      });
    });
  }));

  // Drop same-text duplicates, then shuffle and take count (5h)
  const unique = dedupeQuestions(all);
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  const selected = unique.slice(0, count);
  return { questions: selected, questionIds: selected.map(q => q.id) };
}

export async function getQuestionsForChapter(
  subject: string,
  chapter: string,
  maxQuestions = 30
): Promise<ExamQuestion[]> {
  const q = query(
    collection(db, 'questions'),
    where('subject', '==', subject),
    where('chapter', '==', chapter),
    limit(maxQuestions)
  );
  const snap = await getDocs(q);
  const list = snap.docs
    .filter(doc => ((doc.data().subject as string) ?? '').trim() === subject.trim())
    .map(doc => {
      const d = doc.data();
      const questionType = readQuestionType(d);
      return {
        id: doc.id,
        prompt: (d.question as string) ?? '',
        options: readOptions(d, questionType),
        questionType,
        difficulty: (d.difficulty as string) ?? 'Medium',
        section: chapter,
        answer: (d.answer as string | null) ?? null,
        subject,
        chapter,
        imageUrl: (d.imageUrl as string) || undefined,
      } as ExamQuestion;
    });
  return dedupeQuestions(list);
}
