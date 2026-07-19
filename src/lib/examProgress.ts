/**
 * Crash/refresh recovery for an in-progress exam attempt.
 *
 * Every answer, flag and the remaining time are mirrored to localStorage as
 * they change, so a refresh (or an accidental tab close) resumes exactly where
 * the student left off instead of losing the attempt. The saved record is
 * cleared on submit.
 */

const KEY_PREFIX = 'prepmind_exam_progress:';
/** Saved attempts older than this are ignored — a stale paper shouldn't resurrect. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface SavedExamProgress {
  examId: string;
  answers: Record<number, string>;
  marked: number[];
  visited: number[];
  current: number;
  secondsRemaining: number;
  /** Epoch ms of the last write — used to expire stale records. */
  savedAt: number;
}

function keyFor(examId: string): string {
  return `${KEY_PREFIX}${examId}`;
}

export function saveExamProgress(progress: Omit<SavedExamProgress, 'savedAt'>): void {
  if (!progress.examId) return;
  try {
    const record: SavedExamProgress = { ...progress, savedAt: Date.now() };
    localStorage.setItem(keyFor(progress.examId), JSON.stringify(record));
  } catch {
    // Quota exceeded or storage disabled — the exam must keep working regardless.
  }
}

export function loadExamProgress(examId: string): SavedExamProgress | null {
  if (!examId) return null;
  try {
    const raw = localStorage.getItem(keyFor(examId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedExamProgress;
    if (!parsed || parsed.examId !== examId) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
      clearExamProgress(examId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearExamProgress(examId: string): void {
  if (!examId) return;
  try {
    localStorage.removeItem(keyFor(examId));
  } catch {
    // ignore
  }
}
