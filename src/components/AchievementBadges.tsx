import { useEffect, useMemo, useState } from 'react';
import { getAuthSession } from '../lib/auth';
import { getDailyChallengeCompletions, getEarnedBadgeMonths, isMonthBadgeEarned, todayKey } from '../lib/dailyChallenge';
import type { StudentStream } from '../lib/stream';
import HexBadge from './HexBadge';
import MonthBadge from './MonthBadge';

// Badges earned + what's next, all derived from real daily-challenge
// completions (which themselves come from actually-submitted attempts):
//   • Day milestones — total days the challenge has ever been completed.
//   • Month badges  — every calendar day of a given month completed.
// Nothing is awarded that the student hasn't genuinely done.

const DAY_MILESTONES = [7, 30, 50, 100, 200, 365];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastDayOf(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(last).padStart(2, '0')}`;
}

function BadgeTile({ children, label, sub }: { children: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 92 }}>
      {children}
      <div className="text-center">
        <div className="text-label-sm font-semibold truncate w-full" style={{ color: 'var(--text-primary)' }} title={label}>
          {label}
        </div>
        <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>
      </div>
    </div>
  );
}

export default function AchievementBadges({ stream }: { stream: StudentStream }) {
  const uid = getAuthSession()?.user?.id;
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let cancelled = false;
    getDailyChallengeCompletions(uid, stream)
      .then(set => { if (!cancelled) setCompleted(set); })
      .catch(e => console.error('Badges failed to load:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, stream]);

  const { earned, next } = useMemo(() => {
    const totalDays = completed.size;
    const monthKeys = getEarnedBadgeMonths(completed);

    const earnedList: Array<{ key: string; node: React.ReactNode; label: string; sub: string; sortKey: string }> = [];

    for (const m of DAY_MILESTONES) {
      if (totalDays >= m) {
        earnedList.push({
          key: `days-${m}`,
          node: <HexBadge primary={String(m)} secondary="DAYS" earned size={54} title={`${m} day milestone`} />,
          label: `${m} Days Badge`,
          sub: `${totalDays} days total`,
          sortKey: `1-${String(m).padStart(4, '0')}`,
        });
      }
    }

    for (const mk of monthKeys) {
      const [y, mo] = mk.split('-').map(Number);
      earnedList.push({
        key: `month-${mk}`,
        node: <MonthBadge month0={mo - 1} year={y} earned size={54} />,
        label: `${MONTH_NAMES[mo - 1]} Badge`,
        sub: lastDayOf(mk),
        sortKey: `2-${mk}`,
      });
    }

    earnedList.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    // What's next: this month's badge (with real progress) and the next day
    // milestone, both shown locked until genuinely earned.
    const today = new Date();
    const currentMonthKey = todayKey().slice(0, 7);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    let doneThisMonth = 0;
    completed.forEach(d => { if (d.startsWith(currentMonthKey)) doneThisMonth += 1; });
    const monthPct = Math.round((doneThisMonth / daysInMonth) * 100);
    const monthAlreadyEarned = isMonthBadgeEarned(currentMonthKey, completed);

    const nextMilestone = DAY_MILESTONES.find(m => totalDays < m);

    const nextList: Array<{ key: string; node: React.ReactNode; label: string; sub: string }> = [];
    if (!monthAlreadyEarned) {
      nextList.push({
        key: 'month-progress',
        node: <MonthBadge month0={today.getMonth()} year={today.getFullYear()} earned={false} size={54} />,
        label: `${MONTH_NAMES[today.getMonth()]} Badge`,
        sub: `${monthPct}% · ${doneThisMonth}/${daysInMonth} days`,
      });
    }
    if (nextMilestone !== undefined) {
      nextList.push({
        key: `next-days-${nextMilestone}`,
        node: <HexBadge primary={String(nextMilestone)} secondary="DAYS" earned={false} size={54} title={`${nextMilestone} day milestone`} />,
        label: `${nextMilestone} Days Badge`,
        sub: `${totalDays}/${nextMilestone} days`,
      });
    }

    return { earned: earnedList, next: nextList };
  }, [completed]);

  if (loading) {
    return (
      <div className="mt-5 pt-5 flex gap-4" style={{ borderTop: '1px solid var(--border)' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 w-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-start gap-6 flex-wrap">
        {/* Next up */}
        {next.length > 0 && (
          <div>
            <div className="text-label-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>
              Next Badge
            </div>
            <div className="flex gap-3">
              {next.map(b => <BadgeTile key={b.key} label={b.label} sub={b.sub}>{b.node}</BadgeTile>)}
            </div>
          </div>
        )}

        {next.length > 0 && earned.length > 0 && (
          <div className="self-stretch w-px" style={{ backgroundColor: 'var(--border)' }} />
        )}

        {/* Earned */}
        <div className="flex-1 min-w-0">
          <div className="text-label-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>
            Badges Earned
          </div>
          {earned.length === 0 ? (
            <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
              No badges yet — complete the daily challenge to start earning them.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {earned.map(b => <BadgeTile key={b.key} label={b.label} sub={b.sub}>{b.node}</BadgeTile>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
