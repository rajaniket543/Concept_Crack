import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getStudentAttempts } from './tests';
import { getActivitySummary } from './activity';

export interface XPSource {
  key: string;
  label: string;
  points: number;
  detail: string;
}

export interface XPBreakdown {
  total: number;
  streakDays: number;
  sources: XPSource[];
  recentTests: Array<{ title: string; points: number; correctCount: number; date: string | null }>;
}

const POINTS_PER_CORRECT_ANSWER = 10;
const POINTS_PER_STREAK_DAY     = 5;
const POINTS_PER_STUDY_MINUTE   = 1;

/** Real, fully-traceable XP total — every point maps to something the student
 *  actually did (correct answers, streak days, minutes studied this month).
 *  No fabricated numbers; each source below shows exactly how it was earned. */
export async function getStudentXP(uid: string): Promise<XPBreakdown> {
  if (!uid) return { total: 0, streakDays: 0, sources: [], recentTests: [] };

  const [attempts, progressSnap, activity] = await Promise.all([
    getStudentAttempts(uid).catch(() => []),
    getDoc(doc(db, 'studentProgress', uid)).catch(() => null),
    getActivitySummary(uid).catch(() => null),
  ]);

  const streakDays = (progressSnap?.data()?.streakDays as number) ?? 0;
  const monthMinutes = activity ? Math.round(activity.monthSeconds / 60) : 0;
  const totalCorrect = attempts.reduce((sum, a) => sum + (a.correctCount ?? 0), 0);

  const testPoints   = totalCorrect * POINTS_PER_CORRECT_ANSWER;
  const streakPoints = streakDays * POINTS_PER_STREAK_DAY;
  const studyPoints  = monthMinutes * POINTS_PER_STUDY_MINUTE;

  const sources: XPSource[] = [
    {
      key: 'tests',
      label: 'Test Performance',
      points: testPoints,
      detail: `${totalCorrect} correct answer${totalCorrect === 1 ? '' : 's'} across ${attempts.length} test${attempts.length === 1 ? '' : 's'} · ${POINTS_PER_CORRECT_ANSWER} XP each`,
    },
    {
      key: 'streak',
      label: 'Practice Consistency',
      points: streakPoints,
      detail: `${streakDays} day streak · ${POINTS_PER_STREAK_DAY} XP per day`,
    },
    {
      key: 'study',
      label: 'Study Time',
      points: studyPoints,
      detail: `${monthMinutes} minute${monthMinutes === 1 ? '' : 's'} studied this month · ${POINTS_PER_STUDY_MINUTE} XP per minute`,
    },
  ];

  const recentTests = attempts.slice(0, 5).map(a => ({
    title: a.testTitle ?? 'Test',
    points: (a.correctCount ?? 0) * POINTS_PER_CORRECT_ANSWER,
    correctCount: a.correctCount ?? 0,
    date: a.submittedAt,
  }));

  return { total: testPoints + streakPoints + studyPoints, streakDays, sources, recentTests };
}
