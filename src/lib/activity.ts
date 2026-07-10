// Website-activity / study-time tracking (Feature 4).
//
// While a signed-in student uses the app we accumulate active time (tab visible)
// and bucket it per day + per activity category. Parents see this on their
// dashboard as "Website Activity". Tracking is forward-only — there is no
// historical backfill — and only covers activities that exist today
// (Tests, Practice, AI Practice); Notes/Videos/PYQs light up when those launch.

import { doc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from './firebase';

export type ActivityCategory = 'tests' | 'practice' | 'ai' | 'other';

export const ACTIVITY_META: Record<ActivityCategory, { label: string; icon: string; color: string }> = {
  tests:    { label: 'Tests',        icon: 'quiz',         color: '#F97316' },
  practice: { label: 'Practice',     icon: 'edit_note',    color: '#10B981' },
  ai:       { label: 'AI Practice',  icon: 'auto_awesome', color: '#5B4FE8' },
  other:    { label: 'Browsing',     icon: 'travel_explore', color: '#64748B' },
};

// Categories in the PDF that don't have a module yet — shown as "coming soon".
export const UPCOMING_ACTIVITIES = ['Notes', 'Videos', 'PYQs'] as const;

export function categoryForPath(pathname: string): ActivityCategory {
  if (/\/(exam|assigned-tests|custom-test|battle|chatbot)/.test(pathname)) return 'tests';
  if (/\/practice/.test(pathname)) return 'practice';
  if (/\/(ai-test|insights)/.test(pathname)) return 'ai';
  return 'other';
}

// ── Day helpers ─────────────────────────────────────────────────────────────

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(base: Date, deltaDays: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + deltaDays);
  return d;
}

// ── Recording ─────────────────────────────────────────────────────────────────

let pending: Record<string, Partial<Record<ActivityCategory, number>>> = {};
let currentUid: string | null = null;

export function recordActivity(uid: string, category: ActivityCategory, seconds: number): void {
  if (!uid || seconds <= 0) return;
  currentUid = uid;
  const day = dayKey();
  const bucket = (pending[day] ??= {});
  bucket[category] = (bucket[category] ?? 0) + seconds;
}

export async function flushActivity(): Promise<void> {
  if (!currentUid) return;
  const uid = currentUid;
  const snapshot = pending;
  pending = {};
  const entries = Object.entries(snapshot);
  if (entries.length === 0) return;

  try {
    for (const [day, cats] of entries) {
      let dayTotal = 0;
      const byCategory: Record<string, unknown> = {};
      for (const [cat, secs] of Object.entries(cats)) {
        if (!secs) continue;
        byCategory[cat] = increment(secs);
        dayTotal += secs;
      }
      if (dayTotal === 0) continue;
      // Nested increments inside a merge create missing fields from 0 and are
      // concurrency-safe, so multiple tabs never clobber each other.
      await setDoc(
        doc(db, 'studentActivity', uid),
        { days: { [day]: { total: increment(dayTotal), byCategory } }, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  } catch (e) {
    // Re-queue on failure so time isn't lost.
    for (const [day, cats] of entries) {
      const bucket = (pending[day] ??= {});
      for (const [cat, secs] of Object.entries(cats)) {
        bucket[cat as ActivityCategory] = (bucket[cat as ActivityCategory] ?? 0) + (secs ?? 0);
      }
    }
    console.error('flushActivity failed', e);
  }
}

// ── Reading / aggregation ───────────────────────────────────────────────────

export interface ActivitySummary {
  todaySeconds:    number;
  weekSeconds:     number;   // last 7 days
  monthSeconds:    number;   // last 30 days
  avgDailySeconds: number;   // average over active days in last 30
  byCategory:      Record<ActivityCategory, number>;         // last 30 days
  daily:           Array<{ date: string; label: string; seconds: number }>;  // last 7 days
  weekly:          Array<{ label: string; seconds: number }>;                // last 4 weeks
}

type DayDoc = { total?: number; byCategory?: Partial<Record<ActivityCategory, number>> };

function emptySummary(): ActivitySummary {
  const today = new Date();
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDay(today, i - 6);
    return { date: dayKey(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }), seconds: 0 };
  });
  const weekly = Array.from({ length: 4 }, (_, i) => ({ label: `W${i + 1}`, seconds: 0 }));
  return {
    todaySeconds: 0, weekSeconds: 0, monthSeconds: 0, avgDailySeconds: 0,
    byCategory: { tests: 0, practice: 0, ai: 0, other: 0 },
    daily, weekly,
  };
}

export async function getActivitySummary(uid: string): Promise<ActivitySummary> {
  const empty = emptySummary();
  if (!uid) return empty;
  let days: Record<string, DayDoc> = {};
  try {
    const snap = await getDoc(doc(db, 'studentActivity', uid));
    if (!snap.exists()) return empty;
    days = (snap.data().days ?? {}) as Record<string, DayDoc>;
  } catch {
    return empty;
  }

  const today = new Date();
  const secondsOn = (d: Date) => days[dayKey(d)]?.total ?? 0;

  const todaySeconds = secondsOn(today);

  let weekSeconds = 0, monthSeconds = 0, activeDays = 0;
  const byCategory: Record<ActivityCategory, number> = { tests: 0, practice: 0, ai: 0, other: 0 };
  for (let i = 0; i < 30; i += 1) {
    const d = shiftDay(today, -i);
    const rec = days[dayKey(d)];
    const total = rec?.total ?? 0;
    monthSeconds += total;
    if (i < 7) weekSeconds += total;
    if (total > 0) activeDays += 1;
    const bc = rec?.byCategory ?? {};
    (['tests', 'practice', 'ai', 'other'] as ActivityCategory[]).forEach(c => { byCategory[c] += bc[c] ?? 0; });
  }

  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDay(today, i - 6);
    return { date: dayKey(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }), seconds: secondsOn(d) };
  });

  const weekly = Array.from({ length: 4 }, (_, w) => {
    let sum = 0;
    for (let i = 0; i < 7; i += 1) sum += secondsOn(shiftDay(today, -(w * 7 + i)));
    return { label: w === 0 ? 'This wk' : `${w}w ago`, seconds: sum };
  }).reverse();

  return {
    todaySeconds,
    weekSeconds,
    monthSeconds,
    avgDailySeconds: activeDays > 0 ? Math.round(monthSeconds / activeDays) : 0,
    byCategory,
    daily,
    weekly,
  };
}

// Full per-day activity map (minutes) for the contribution calendar heatmap.
export async function getDailyActivityMinutes(uid: string): Promise<Record<string, number>> {
  if (!uid) return {};
  try {
    const snap = await getDoc(doc(db, 'studentActivity', uid));
    if (!snap.exists()) return {};
    const days = (snap.data().days ?? {}) as Record<string, DayDoc>;
    const out: Record<string, number> = {};
    Object.entries(days).forEach(([date, rec]) => {
      const mins = Math.round((rec?.total ?? 0) / 60);
      if (mins > 0) out[date] = mins;
    });
    return out;
  } catch {
    return {};
  }
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}
