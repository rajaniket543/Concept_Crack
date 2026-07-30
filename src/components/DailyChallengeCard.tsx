import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthSession } from '../lib/auth';
import {
  getOrCreateDailyChallengeTest, getDailyChallengeCompletions, isMonthBadgeEarned,
  todayKey, QUESTIONS_PER_SUBJECT, type DailyChallenge,
} from '../lib/dailyChallenge';
import type { StudentStream } from '../lib/stream';
import { pathFor } from '../lib/pages';
import { todaySummaryFrom, type DayActivity } from '../lib/studyCalendar';
import MonthBadge from './MonthBadge';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKeyOf(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}

function msUntilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export default function DailyChallengeCard({
  stream,
  activity = {},
}: {
  stream: StudentStream;
  /** Per-day real study activity, fetched once by the dashboard and shared. */
  activity?: Record<string, DayActivity>;
}) {
  const session = getAuthSession();
  const uid = session?.user?.id;

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  // Bumped to force the load effect to re-run on Retry (uid/stream don't
  // change, so they alone wouldn't re-trigger it).
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getOrCreateDailyChallengeTest(uid, stream),
      getDailyChallengeCompletions(uid, stream),
    ]).then(([c, completions]) => {
      if (cancelled) return;
      setChallenge(c);
      setCompleted(completions);
    }).catch(e => {
      console.error('Daily challenge failed to load:', e);
      if (!cancelled) setError("Couldn't load today's challenge. Check your connection and try again.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, stream, retryTick]);

  const todaySummary = useMemo(() => todaySummaryFrom(activity, todayKey()), [activity]);
  const isTodayCompleted = completed.has(todayKey());
  const isViewingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const viewedMonthKey = monthKeyOf(viewYear, viewMonth);
  const badgeEarned = useMemo(() => isMonthBadgeEarned(viewedMonthKey, completed), [viewedMonthKey, completed]);

  const cells = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const arr: Array<{ day: number; key: string } | null> = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, key: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    return arr;
  }, [viewYear, viewMonth]);

  function goMonth(delta: number) {
    let y = viewYear, m = viewMonth + delta;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    // Never navigate past the current real month — there's nothing to show ahead.
    if (y > today.getFullYear() || (y === today.getFullYear() && m > today.getMonth())) return;
    setViewYear(y); setViewMonth(m);
  }

  const thirdSubject = stream === 'NEET' ? 'Biology' : 'Mathematics';

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <div className="text-title-md font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Day {today.getDate()} <span className="text-body-sm font-normal" style={{ color: 'var(--text-faint)' }}>· {formatCountdown(msUntilMidnight(now))} left</span>
          </div>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {QUESTIONS_PER_SUBJECT} Physics · {QUESTIONS_PER_SUBJECT} Chemistry · {QUESTIONS_PER_SUBJECT} {thirdSubject} — same for every {stream} student today
          </p>
        </div>

        {/* Hexagonal monthly badge — filled when every day of the shown month is complete.
            Earned badges also show in the profile's Achievements gallery (Settings). */}
        <div className="shrink-0">
          <MonthBadge month0={viewMonth} year={viewYear} earned={badgeEarned} />
        </div>
      </div>

      {/* Month nav + calendar grid */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => goMonth(-1)} className="icon-btn icon-btn-sm" aria-label="Previous month">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
        </button>
        <span className="text-label-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" onClick={() => goMonth(1)} disabled={isViewingCurrentMonth} className="icon-btn icon-btn-sm disabled:opacity-30" aria-label="Next month">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold" style={{ color: 'var(--text-faint)' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const isDone = completed.has(cell.key);
          const isToday = cell.key === todayKey();
          // Past days open in review-only mode; today is taken live via the
          // CTA below; future days aren't reachable at all.
          const isPast = cell.key < todayKey();
          const inner = (
            <>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold"
                style={isToday
                  ? { backgroundColor: 'var(--brand)', color: '#fff' }
                  : { color: 'var(--text-secondary)' }}
              >
                {cell.day}
              </div>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isDone ? 'var(--brand)' : 'var(--surface-muted)' }}
              />
            </>
          );
          return isPast ? (
            <Link
              key={i}
              to={pathFor('dailyChallengeReview')}
              state={{ date: cell.key, stream }}
              title={`Review ${cell.key}`}
              className="flex flex-col items-center gap-1 py-1 rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
            >
              {inner}
            </Link>
          ) : (
            <div key={i} className="flex flex-col items-center gap-1 py-1">
              {inner}
            </div>
          );
        })}
      </div>

      {/* Today's real study totals across every activity, not just the challenge */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-label-sm font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-faint)' }}>
          Today's Study Summary
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Answered', value: String(todaySummary.solved),                                     color: 'var(--brand)' },
            { label: 'Study time', value: formatMinutes(todaySummary.minutes),                           color: '#F59E0B' },
            { label: 'Accuracy', value: todaySummary.accuracyPct !== null ? `${todaySummary.accuracyPct}%` : '—', color: '#10B981' },
            { label: 'XP earned', value: `+${todaySummary.xp}`,                                          color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-base font-bold font-headline" style={{ color: s.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {s.value}
              </div>
              <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        // Never leave an inert CTA behind — a failed load gets a visible retry.
        <button
          type="button"
          onClick={() => setRetryTick(t => t + 1)}
          className="mt-4 w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-bold transition-all hover:-translate-y-px"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.30)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
          Couldn't load — Retry
        </button>
      ) : (
        <Link
          to={challenge ? pathFor('exam') : '#'}
          state={challenge ? { testId: challenge.id } : undefined}
          className="mt-4 w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-bold transition-all hover:-translate-y-px"
          style={isTodayCompleted
            ? { backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', pointerEvents: 'none' }
            : { background: 'linear-gradient(135deg, var(--brand), #7C3AED)', color: '#fff', opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}
        >
          {isTodayCompleted ? (
            <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span> Completed today</>
          ) : (
            <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>bolt</span> {loading ? 'Loading…' : "Start Today's Challenge"}</>
          )}
        </Link>
      )}
    </div>
  );
}
