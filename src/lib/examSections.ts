import type { ExamQuestion } from './questions';
import { STREAM_COLORS, STREAM_SUBJECTS } from './stream';

/**
 * Official JEE Main / NEET question-palette states.
 *
 * Derived from (visited, answered, marked) rather than stored, so the palette
 * can never drift out of sync with the actual answer state.
 */
export type PaletteState =
  | 'not-visited'      // never opened            — grey
  | 'not-answered'     // opened, left blank      — white
  | 'answered'         // has an answer           — green
  | 'marked'           // flagged, no answer      — purple
  | 'answered-marked'; // flagged AND answered    — purple + green marker

export const PALETTE_STYLES: Record<PaletteState, { bg: string; color: string; border: string; label: string }> = {
  'not-visited':     { bg: '#9CA3AF', color: '#FFFFFF', border: '#9CA3AF', label: 'Not Visited' },
  'not-answered':    { bg: '#FFFFFF', color: '#111827', border: '#9CA3AF', label: 'Not Answered' },
  'answered':        { bg: '#10B981', color: '#FFFFFF', border: '#10B981', label: 'Answered' },
  'marked':          { bg: '#7C3AED', color: '#FFFFFF', border: '#7C3AED', label: 'Marked for Review' },
  'answered-marked': { bg: '#7C3AED', color: '#FFFFFF', border: '#7C3AED', label: 'Answered & Marked' },
};

export function derivePaletteState(
  globalIndex: number,
  answers: Record<number, string>,
  marked: Set<number>,
  visited: Set<number>,
): PaletteState {
  const hasAnswer = (answers[globalIndex] ?? '') !== '';
  const isMarked = marked.has(globalIndex);
  if (isMarked) return hasAnswer ? 'answered-marked' : 'marked';
  if (hasAnswer) return 'answered';
  return visited.has(globalIndex) ? 'not-answered' : 'not-visited';
}

/** One subject's worth of questions within a paper. */
export interface ExamSection {
  subject: string;
  color: string;
  /** Global 1-based question indices belonging to this subject, in paper order. */
  indices: number[];
}

const CANONICAL_ORDER = [
  ...new Set([...STREAM_SUBJECTS.JEE, ...STREAM_SUBJECTS.NEET]),
];

/**
 * Splits a flat question list into per-subject sections, ordered by the
 * canonical stream order (Physics → Chemistry → Mathematics/Biology) with any
 * unrecognised subjects appended alphabetically.
 *
 * Questions with no `subject` fall back to `fallbackSubject` so a single-subject
 * practice run still produces exactly one well-formed section.
 */
export function buildSections(questions: ExamQuestion[], fallbackSubject: string): ExamSection[] {
  const bySubject = new Map<string, number[]>();

  questions.forEach((q, i) => {
    const subject = (q.subject || fallbackSubject || 'General').trim() || 'General';
    const list = bySubject.get(subject);
    if (list) list.push(i + 1);
    else bySubject.set(subject, [i + 1]);
  });

  const rank = (s: string) => {
    const idx = CANONICAL_ORDER.indexOf(s);
    return idx === -1 ? CANONICAL_ORDER.length : idx;
  };

  return [...bySubject.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([subject, indices]) => ({
      subject,
      color: STREAM_COLORS[subject] ?? '#5B4FE8',
      indices,
    }));
}

/** Which section contains a given global question index. */
export function sectionOf(sections: ExamSection[], globalIndex: number): number {
  const i = sections.findIndex(s => s.indices.includes(globalIndex));
  return i === -1 ? 0 : i;
}

export interface SectionProgress {
  answered: number;
  total: number;
  marked: number;
}

export function sectionProgress(
  section: ExamSection,
  answers: Record<number, string>,
  marked: Set<number>,
): SectionProgress {
  let answeredCount = 0;
  let markedCount = 0;
  section.indices.forEach(idx => {
    if ((answers[idx] ?? '') !== '') answeredCount += 1;
    if (marked.has(idx)) markedCount += 1;
  });
  return { answered: answeredCount, total: section.indices.length, marked: markedCount };
}
