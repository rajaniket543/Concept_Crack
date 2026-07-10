// Single source of truth for "days remaining to exam" across every portal.
// Never hardcode a year or a day count anywhere else — always derive it here
// so every dashboard stays in sync and the count updates automatically as
// today's date moves forward.

import type { StudentStream } from './stream';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Estimated exam dates. Update here (and only here) when official dates are
// announced or a new exam cycle needs to be added.
const EXAM_DATES: Record<StudentStream, { label: string; date: Date }> = {
  JEE:  { label: 'JEE',  date: new Date('2027-01-15T00:00:00') },
  NEET: { label: 'NEET', date: new Date('2027-05-02T00:00:00') },
};

export interface ExamCountdown {
  examLabel:     string;   // e.g. "JEE 2027"
  daysRemaining: number;   // 0 once the exam date has passed
  isPast:        boolean;
  display:       string;   // ready-to-render "JEE 2027 · 47 days remaining"
}

/** Computed fresh on every call from `now` (defaults to the real current time). */
export function getExamCountdown(stream: StudentStream, now: Date = new Date()): ExamCountdown {
  const { label, date } = EXAM_DATES[stream];
  const examLabel = `${label} ${date.getFullYear()}`;
  const daysRemaining = Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY);

  if (daysRemaining <= 0) {
    return { examLabel, daysRemaining: 0, isPast: true, display: `${examLabel} · Preparing for Next Session` };
  }
  return {
    examLabel,
    daysRemaining,
    isPast: false,
    display: `${examLabel} · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`,
  };
}

/** Convenience for call sites that only want the rendered string. */
export function formatExamCountdown(stream: StudentStream | null | undefined, fallback = 'JEE/NEET'): string {
  if (!stream) return fallback;
  return getExamCountdown(stream).display;
}
