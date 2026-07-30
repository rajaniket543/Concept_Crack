// Per-day study activity for the contribution calendar + today's summary.
//
// Combines the two real sources already tracked by the app — active study time
// (studentActivity, via getDailyActivityMinutes) and submitted test attempts
// (testAttempts, via getStudentAttempts) — into one per-day map. Nothing here
// is derived from anything that isn't genuinely recorded: a day with no
// attempts reports 0 solved and no accuracy, rather than an invented figure.

import { getDailyActivityMinutes } from './activity';
import { getStudentAttempts } from './tests';

export interface DayActivity {
  date: string;        // 'YYYY-MM-DD'
  minutes: number;     // active study minutes
  solved: number;      // questions actually answered (correct + incorrect)
  correct: number;
  /** null when nothing was attempted that day — never shown as "0% accuracy". */
  accuracyPct: number | null;
  tests: number;       // tests submitted that day
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getDailyStudyActivity(uid: string): Promise<Record<string, DayActivity>> {
  if (!uid) return {};
  const [minutesByDay, attempts] = await Promise.all([
    getDailyActivityMinutes(uid).catch(() => ({} as Record<string, number>)),
    getStudentAttempts(uid).catch(() => []),
  ]);

  const map: Record<string, DayActivity> = {};
  const ensure = (date: string): DayActivity =>
    (map[date] ??= { date, minutes: 0, solved: 0, correct: 0, accuracyPct: null, tests: 0 });

  Object.entries(minutesByDay).forEach(([date, minutes]) => { ensure(date).minutes = minutes; });

  for (const a of attempts) {
    if (a.status !== 'submitted' || !a.submittedAt) continue;
    const day = ensure(localDayKey(a.submittedAt));
    day.solved  += (a.correctCount ?? 0) + (a.incorrectCount ?? 0);
    day.correct += a.correctCount ?? 0;
    day.tests   += 1;
  }

  Object.values(map).forEach(d => {
    d.accuracyPct = d.solved > 0 ? Math.round((d.correct / d.solved) * 100) : null;
  });

  return map;
}

export interface TodaySummary {
  solved: number;
  minutes: number;
  accuracyPct: number | null;
  xp: number;
}

const XP_PER_CORRECT = 10; // same rate as src/lib/xp.ts

/** Today's real totals across every activity, pulled straight from the map. */
export function todaySummaryFrom(map: Record<string, DayActivity>, todayKeyStr: string): TodaySummary {
  const d = map[todayKeyStr];
  return {
    solved: d?.solved ?? 0,
    minutes: d?.minutes ?? 0,
    accuracyPct: d?.accuracyPct ?? null,
    xp: (d?.correct ?? 0) * XP_PER_CORRECT,
  };
}
