import { collection, query, where, getDocs, limit } from 'firebase/firestore';
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
