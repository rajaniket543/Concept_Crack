import { collection, query, where, getDocs, limit, documentId } from 'firebase/firestore';
import { db } from './firebase';

export interface ChapterInfo {
  id: string;
  subject: string;
  chapter: string;
  stream: string;
  questionCount: number;
}

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
  difficulty: string;
  section: string;
  answer: string | null;
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
      const opts = (d.options ?? {}) as Record<string, string>;
      results.push({
        id: doc.id,
        prompt: (d.question as string) ?? '',
        options: (['A', 'B', 'C', 'D'] as const).map(k => ({ key: k, text: opts[k] ?? '' })),
        difficulty: (d.difficulty as string) ?? 'Medium',
        section: (d.chapter as string) ?? '',
        answer: (d.answer as string | null) ?? null,
      });
    });
  }
  // restore original order
  const byId = new Map(results.map(q => [q.id, q]));
  return ids.map(id => byId.get(id)).filter(Boolean) as ExamQuestion[];
}

export async function getQuestionsForCustomTest(config: {
  subject: string;
  chapters: string[];
  difficulty: string;
  count: number;
}): Promise<{ questions: ExamQuestion[]; questionIds: string[] }> {
  const { subject, chapters, difficulty, count } = config;
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
      const opts = (d.options ?? {}) as Record<string, string>;
      all.push({
        id: doc.id,
        prompt: (d.question as string) ?? '',
        options: (['A', 'B', 'C', 'D'] as const).map(k => ({ key: k, text: opts[k] ?? '' })),
        difficulty: (d.difficulty as string) ?? 'Medium',
        section: (d.chapter as string) ?? chapter,
        answer: (d.answer as string | null) ?? null,
      });
    });
  }));

  // shuffle and take count
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const selected = all.slice(0, count);
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
  return snap.docs.map(doc => {
    const d = doc.data();
    const opts = (d.options ?? {}) as Record<string, string>;
    return {
      id: doc.id,
      prompt: (d.question as string) ?? '',
      options: (['A', 'B', 'C', 'D'] as const).map(k => ({
        key: k,
        text: opts[k] ?? '',
      })),
      difficulty: (d.difficulty as string) ?? 'Medium',
      section: (d.chapter as string) ?? subject,
      answer: (d.answer as string | null) ?? null,
    };
  });
}
