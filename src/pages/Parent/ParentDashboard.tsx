import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import { parentActivity, parentMastery, parentMetrics, parentReports } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { getLinkedStudentData, getStudentDashboard } from '../../lib/db';
import { getStudentAttempts, type TestAttempt } from '../../lib/tests';
import { getActivitySummary, getDailyActivityMinutes, formatDuration, ACTIVITY_META, UPCOMING_ACTIVITIES, type ActivitySummary, type ActivityCategory } from '../../lib/activity';
import { getExamCountdown } from '../../lib/examCountdown';
import type { StudentStream } from '../../lib/stream';

const SUBJECT_ICON: Record<string, string> = {
  Physics: 'electric_bolt', Chemistry: 'science', Mathematics: 'calculate', Biology: 'biotech',
};

// Days (of the last 7) with recorded activity, plus the longest run of
// consecutive active days across all recorded history — both derived purely
// from the real per-day activity map, no fabricated numbers.
function computeStreakStats(activityMap: Record<string, number>) {
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  let daysThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if ((activityMap[keyOf(d)] ?? 0) > 0) daysThisWeek++;
  }
  const activeDates = Object.keys(activityMap).filter(k => activityMap[k] > 0).sort();
  let longest = 0, current = 0, prevTime: number | null = null;
  for (const key of activeDates) {
    const t = new Date(`${key}T00:00:00`).getTime();
    current = prevTime !== null && t - prevTime === 86400000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    prevTime = t;
  }
  return { daysThisWeek, longestStreak: longest };
}

export default function ParentDashboard() {
  const session = getAuthSession();

  const [data, setData] = useState<any>({
    metrics: parentMetrics,
    mastery: parentMastery,
    reports: parentReports,
    activity: parentActivity,
    latestPrediction: 94.5,
  });
  const [linkedStudent, setLinkedStudent] = useState<any>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [activityMap, setActivityMap] = useState<Record<string, number>>({});
  const [activityPeriod, setActivityPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) return;

    getLinkedStudentData(session.user.id).then(async stu => {
      if (cancelled) return;
      if (!stu) return;
      setLinkedStudent(stu);

      // Website-activity summary (Feature 4)
      getActivitySummary(stu.id).then(a => { if (!cancelled) setActivity(a); }).catch(() => undefined);
      getDailyActivityMinutes(stu.id).then(m => { if (!cancelled) setActivityMap(m); }).catch(() => undefined);
      getStudentAttempts(stu.id).then(a => { if (!cancelled) setAttempts(a); }).catch(() => undefined);

      // Fetch the exact same dashboard data the student sees
      const dash = await getStudentDashboard(stu.id).catch(() => null);
      if (cancelled || !dash) return;

      // Map student metrics → parent format (same values, parent-friendly labels)
      const realMetrics = [
        { label: 'Current Rank',      value: dash.metrics[1]?.value ?? '—', trend: 0 },
        { label: 'Performance Score', value: dash.metrics[0]?.value ?? '—', trend: 0 },
        { label: 'Practice Streak',   value: dash.metrics[2]?.value ?? '—', trend: 0 },
        { label: 'Tests Completed',   value: dash.metrics[3]?.value ?? '0',  trend: 0 },
      ];

      const realMastery = (dash.subjectPerformance as Array<{ subject: string; pct: number }>).map(s => ({
        subject: s.subject,
        pct:     s.pct,
        mastery: s.pct,
      }));

      // Recent activity from student progress
      const lastAct = stu.progress?.lastActivity;
      const realActivity = lastAct ? [{
        type:  lastAct.type ?? 'test',
        title: lastAct.title,
        score: lastAct.accuracy ?? (lastAct as any).score,
        time:  lastAct.completedAt
          ? new Date(lastAct.completedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
          : 'Recently',
      }] : [];

      const scoreStr = dash.metrics[0]?.value ?? '0%';
      const latestPrediction = parseFloat(scoreStr) || 0;

      setData({
        metrics:           realMetrics,
        mastery:           realMastery.length > 0 ? realMastery : parentMastery,
        activity:          realActivity.length > 0 ? realActivity : parentActivity,
        reports:           parentReports,
        latestPrediction,
        weakAreas:         dash.weakAreas ?? [],
      });
    }).catch(() => undefined);

    return () => { cancelled = true; };
  }, []);

  const metricMeta = [
    { icon: 'score',           color: 'var(--parent-accent)', bg: 'rgba(249,115,22,0.12)' },
    { icon: 'military_tech',   color: 'var(--parent-accent)', bg: 'rgba(249,115,22,0.12)' },
    { icon: 'calendar_month',  color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { icon: 'trending_up',     color: 'var(--parent-accent)', bg: 'rgba(249,115,22,0.12)' },
  ];

  const subjectColors: Record<string, string> = { Physics: 'var(--parent-accent)', Chemistry: 'var(--parent-accent-hover)', Mathematics: '#10B981' };

  const parentName  = session?.user?.name ?? 'there';
  const hour        = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const childName    = linkedStudent?.name       ?? 'your child';
  const childStream  = (linkedStudent?.stream as StudentStream) ?? 'JEE';
  const countdown    = getExamCountdown(childStream);
  const childRank    = linkedStudent?.rank       ?? 247;
  const childScore   = linkedStudent?.score      ?? 92;
  const childTarget  = linkedStudent?.examTarget ?? countdown.examLabel;
  const attendance   = linkedStudent?.attendance ?? null;
  const initials     = childName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const { daysThisWeek, longestStreak } = computeStreakStats(activityMap);

  // Weakest subject, derived from the same real mastery data rendered below — used to compose the AI summary line.
  const mastery: Array<{ subject: string; pct?: number; mastery?: number }> = data.mastery ?? [];
  const weakestSubject = mastery.length > 0
    ? [...mastery].sort((a, b) => (a.pct ?? a.mastery ?? 0) - (b.pct ?? b.mastery ?? 0))[0]
    : null;
  const needsAttention = mastery.some(s => (s.pct ?? s.mastery ?? 100) < 60);

  const mockAttempts = attempts.filter(a => a.testType === 'mock');
  const mockImprovement = mockAttempts.length >= 2 ? mockAttempts[0].accuracyPct - mockAttempts[1].accuracyPct : null;
  const recentAttempts = attempts.slice(0, 3);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Parent Dashboard' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">

        {/* Greeting */}
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            {timeGreeting}, {parentName.split(' ')[0]}
          </h1>
          <p className="text-body-md mt-1.5 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
            Here's how {childName.split(' ')[0]} is progressing.
            {' '}{daysThisWeek > 0
              ? `They've studied ${daysThisWeek} of the last 7 days${weakestSubject ? `, and ${weakestSubject.subject} is the area worth a gentle nudge.` : '.'}`
              : "No study activity recorded yet this week."}
          </p>
          <div
            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ color: 'var(--parent-accent)', backgroundColor: 'var(--parent-accent-muted)', boxShadow: 'inset 0 0 0 1px rgba(249,115,22,0.25)' }}
          >
            {countdown.display}
          </div>
        </div>

        {/* AI Parent Summary */}
        <div
          className="relative overflow-hidden rounded-xl p-6"
          style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.14) 0%, var(--surface) 55%)', border: '1px solid rgba(249,115,22,0.22)' }}
        >
          <div
            className="absolute pointer-events-none"
            style={{ right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.20), transparent 70%)' }}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between flex-wrap gap-2 mb-3.5">
            <div className="flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wide" style={{ color: 'var(--parent-accent)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              AI Parent Summary
            </div>
            <div className="text-label-sm font-semibold" style={{ color: 'var(--text-faint)' }}>
              Updated {new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
          <p className="relative text-body-md leading-relaxed max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            {childName} has studied <strong style={{ color: 'var(--text-primary)' }}>{daysThisWeek} of the last 7 days</strong>, currently ranked #{childRank} with a performance score of {childScore}%.
            {weakestSubject
              ? <> <strong style={{ color: 'var(--text-primary)' }}>{weakestSubject.subject} needs a bit more attention</strong> — it's at {weakestSubject.pct ?? weakestSubject.mastery}% accuracy, the lowest of the tracked subjects.</>
              : ' Subject-wise accuracy will show up here once test results come in.'}
            {' '}{needsAttention ? 'A short focused revision session there would help.' : 'Overall the current pace looks steady.'}
          </p>
          <div className="relative flex items-center gap-1.5 text-label-sm mt-4" style={{ color: 'var(--text-faint)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--parent-accent)' }}>schedule</span>
            This summary refreshes automatically as {childName.split(' ')[0]} studies.
          </div>
        </div>

        {/* Child profile card */}
        <div className="rounded-xl p-5 flex items-center gap-5 flex-wrap" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-lg shrink-0" style={{ background: 'linear-gradient(135deg, var(--parent-accent), var(--parent-accent-hover))' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-headline-sm font-bold mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{childName}</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-label-sm font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{childStream}</span>
              <span className="text-label-sm font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{childTarget}</span>
              {attendance !== null && (
                <span className="text-label-sm font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{attendance}% attendance</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', minWidth: 80 }}>
            <div className="text-lg font-extrabold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--parent-accent)' }}>{countdown.daysRemaining}</div>
            <div className="text-[9px] uppercase tracking-wide font-semibold mt-0.5" style={{ color: 'var(--text-faint)' }}>Days to exam</div>
          </div>
          <span className={`badge ${needsAttention ? '' : 'badge-success'}`} style={needsAttention ? { backgroundColor: 'rgba(245,158,11,0.12)', color: '#D97706' } : undefined}>
            <span className="material-symbols-outlined filled" style={{ fontSize: '12px' }}>{needsAttention ? 'priority_high' : 'trending_up'}</span>
            {needsAttention ? 'Needs Attention' : 'On Track'}
          </span>
        </div>

        {/* Progress This Month */}
        <Card title="Progress This Month" subtitle={`${childName.split(' ')[0]}'s own improvement over time — not a comparison with other students`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Study Consistency',   value: `${daysThisWeek}/7 days`, icon: 'calendar_month', real: true, bar: Math.round((daysThisWeek / 7) * 100) },
              {
                label: 'Mock Test Improvement',
                value: mockImprovement !== null ? `${mockImprovement > 0 ? '+' : ''}${mockImprovement}%` : '—',
                icon: 'trending_up', real: mockImprovement !== null, bar: mockImprovement !== null ? Math.min(100, Math.max(0, 50 + mockImprovement)) : 0,
                note: mockImprovement === null ? 'Needs 2+ mock tests' : undefined,
              },
              { label: 'Attendance', value: attendance !== null ? `${attendance}%` : '—', icon: 'event_available', real: attendance !== null, bar: attendance ?? 0 },
              { label: 'Monthly Growth',        icon: 'show_chart' },
              { label: 'Practice Completion',   icon: 'assignment_turned_in' },
              { label: 'Revision Completion',   icon: 'menu_book' },
              { label: 'Schedule Completion',   icon: 'event_repeat' },
              { label: 'Weak Concepts Reduced', icon: 'psychology' },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', opacity: m.real === false ? 0.65 : 1 }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: m.real ? 'var(--parent-accent-muted)' : 'var(--surface)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: m.real ? 'var(--parent-accent)' : 'var(--text-faint)' }}>{m.icon}</span>
                  </div>
                  <span className="text-label-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                </div>
                <div className="text-xl font-extrabold font-headline mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: m.real === false ? 'var(--text-faint)' : 'var(--text-primary)' }}>
                  {m.value ?? '—'}
                </div>
                {m.real ? (
                  <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${m.bar}%`, backgroundColor: 'var(--parent-accent)' }} /></div>
                ) : (
                  <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{m.note ?? 'Not tracked yet'}</div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Study activity calendar + Where time is spent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Study Activity" subtitle={`Which days ${childName.split(' ')[0]} studied over the last 6 months`}>
            <ActivityHeatmap data={activityMap} colorBase="#F97316" unit="min" />
            <div className="flex items-center justify-between mt-4 text-body-sm" style={{ color: 'var(--text-muted)' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{daysThisWeek} of 7</strong> days studied this week</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{longestStreak} day{longestStreak === 1 ? '' : 's'}</strong> longest streak</span>
            </div>
          </Card>

          <Card title="Where Time Is Spent" subtitle="Last 30 days">
            {activity ? (() => {
              const cats = ['tests', 'practice', 'ai', 'other'] as ActivityCategory[];
              const max = Math.max(1, ...cats.map(c => activity.byCategory[c]));
              const anyTime = cats.some(c => activity.byCategory[c] > 0);
              return anyTime ? (
                <div className="space-y-3">
                  {cats.map(c => {
                    const meta = ACTIVITY_META[c];
                    const secs = activity.byCategory[c];
                    return (
                      <div key={c} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1A` }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: meta.color }}>{meta.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
                            <span className="text-label-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{formatDuration(secs)}</span>
                          </div>
                          <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${Math.round((secs / max) * 100)}%`, backgroundColor: meta.color }} /></div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {UPCOMING_ACTIVITIES.map(a => (
                      <span key={a} className="text-label-sm px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-faint)', border: '1px dashed var(--border)' }}>
                        {a} · coming soon
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-body-sm rounded-xl p-4" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  No activity recorded yet. Time will appear here as soon as {childName.split(' ')[0]} starts using the platform.
                </p>
              );
            })() : <div className="h-40 skeleton rounded-lg" />}
          </Card>
        </div>

        {/* Website Activity */}
        {activity && (
          <Card
            title="Website Activity"
            subtitle="Time spent on Concept Crack, updates live as they study"
            action={
              <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)' }}>
                {(['today', 'week', 'month'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setActivityPeriod(p)}
                    className="text-label-sm font-semibold px-2.5 py-1 rounded-md transition-all"
                    style={activityPeriod === p ? { backgroundColor: 'var(--parent-accent)', color: '#fff' } : { color: 'var(--text-muted)' }}
                  >
                    {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                  </button>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { period: 'today' as const, label: 'Today',            value: activity.todaySeconds,    icon: 'today' },
                { period: 'week'  as const, label: 'This Week',        value: activity.weekSeconds,     icon: 'date_range' },
                { period: 'month' as const, label: 'This Month',       value: activity.monthSeconds,    icon: 'calendar_month' },
                { period: null,             label: 'Avg / Active Day', value: activity.avgDailySeconds, icon: 'timelapse' },
              ].map(t => {
                const isActive = t.period !== null && t.period === activityPeriod;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={t.period ? () => setActivityPeriod(t.period!) : undefined}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      backgroundColor: isActive ? 'var(--parent-accent-muted)' : 'var(--surface-muted)',
                      border: isActive ? '1px solid var(--parent-accent)' : '1px solid var(--border)',
                      cursor: t.period ? 'pointer' : 'default',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--parent-accent)' }}>{t.icon}</span>
                      <span className="text-label-sm uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{t.label}</span>
                    </div>
                    <div className="text-2xl font-bold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{formatDuration(t.value)}</div>
                  </button>
                );
              })}
            </div>
            <h3 className="text-label-lg font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>Daily usage · last 7 days</h3>
            <DailyUsageChart daily={activity.daily} />
          </Card>
        )}

        {/* Schedule tracking — fully illustrative, no real schedule data exists yet */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="Today's Schedule" subtitle="Illustrative — personalized scheduling is coming soon" className="lg:col-span-2">
            <div className="space-y-1">
              {[
                { title: 'Morning revision block', sub: 'Suggested for early study hours', state: 'done' as const },
                { title: 'Practice set — weak topics', sub: 'Suggested for midday', state: 'done' as const },
                { title: 'Evening practice block', sub: 'Scheduled for later today', state: 'pending' as const },
                { title: 'Weekly revision recap', sub: 'Was due yesterday', state: 'missed' as const },
              ].map(item => {
                const stateColor = item.state === 'done' ? '#10B981' : item.state === 'missed' ? '#EF4444' : 'var(--text-muted)';
                const stateBg = item.state === 'done' ? 'rgba(16,185,129,0.12)' : item.state === 'missed' ? 'rgba(239,68,68,0.12)' : 'var(--surface-muted)';
                return (
                  <div key={item.title} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: stateBg, color: stateColor, border: item.state === 'pending' ? '1.5px solid var(--border)' : 'none' }}>
                      {item.state !== 'pending' && (
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{item.state === 'done' ? 'check' : 'close'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                      <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                    <span className="text-label-sm font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: stateColor, backgroundColor: stateBg }}>
                      {item.state === 'done' ? 'Done' : item.state === 'missed' ? 'Missed' : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Schedule Completion" subtitle="Illustrative">
            <div className="flex flex-col items-center justify-center py-2">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `conic-gradient(var(--parent-accent) 68%, var(--border) 0)` }}
              >
                <div className="w-[70px] h-[70px] rounded-full flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--surface)' }}>
                  <span className="text-xl font-extrabold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>68%</span>
                </div>
              </div>
              <div className="text-label-sm mt-2" style={{ color: 'var(--text-muted)' }}>Tasks completed today</div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[{ label: 'Completed', value: 2, color: '#10B981' }, { label: 'Remaining', value: 1, color: 'var(--text-muted)' }, { label: 'Missed', value: 1, color: '#EF4444' }].map(m => (
                <div key={m.label} className="text-center rounded-lg py-2" style={{ backgroundColor: 'var(--surface-muted)' }}>
                  <div className="text-base font-extrabold" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-[9px] uppercase tracking-wide font-semibold mt-0.5" style={{ color: 'var(--text-faint)' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* AI Alerts — fully illustrative, no automated-alert pipeline exists yet */}
        <Card title="AI Alerts" subtitle="Illustrative — automated alerts coming soon">
          <div className="space-y-2.5">
            {[
              { icon: 'warning', color: '#D97706', bg: 'rgba(245,158,11,0.14)', title: 'A subject may be falling behind', desc: 'Revision hasn’t been touched in a few days for the weakest subject.', rec: 'A light 20-minute revisit before the weekend' },
              { icon: 'trending_up', color: '#10B981', bg: 'rgba(16,185,129,0.14)', title: 'Positive trend detected', desc: 'Practice completion has trended upward recently.', rec: 'Keep the current pace, no changes needed' },
              { icon: 'event', color: '#3B82F6', bg: 'rgba(59,130,246,0.14)', title: 'Upcoming mock test', desc: 'The next full-length mock test is coming up soon.', rec: 'A lighter, earlier study day beforehand' },
            ].map(a => (
              <div key={a.title} className="flex gap-3 p-3.5 rounded-xl" style={{ backgroundColor: 'var(--surface-muted)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: a.bg, color: a.color }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{a.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>{a.title}</div>
                  <div className="text-label-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.desc}</div>
                  <div className="flex items-center gap-1.5 text-label-sm font-semibold mt-1.5" style={{ color: 'var(--parent-accent)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
                    Recommended: {a.rec}
                  </div>
                </div>
              </div>
            ))}
            <Link to={pathFor('messages')} className="text-label-sm font-semibold inline-flex items-center gap-1 pt-1" style={{ color: 'var(--parent-accent)' }}>
              Message the faculty
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
            </Link>
          </div>
        </Card>

        {/* Subject overview — accuracy is real per-subject mastery; the other three
            metrics per subject aren't tracked and are clearly marked as such. */}
        <Card title="Subject Overview" subtitle="Accuracy, revision, practice and confidence by subject">
          <div className="space-y-3">
            {mastery.length === 0 && <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>Subject data will appear here once test results come in.</p>}
            {mastery.map(s => {
              const color = subjectColors[s.subject] ?? 'var(--brand)';
              const acc = s.pct ?? s.mastery ?? 0;
              return (
                <div key={s.subject} className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--parent-accent-muted)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--parent-accent)' }}>{SUBJECT_ICON[s.subject] ?? 'menu_book'}</span>
                    </div>
                    <span className="text-body-md font-bold" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-label-sm font-semibold">
                        <span style={{ color: 'var(--text-muted)' }}>Accuracy</span><span style={{ color: 'var(--text-primary)' }}>{acc}%</span>
                      </div>
                      <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${acc}%`, backgroundColor: color }} /></div>
                    </div>
                    {['Revision', 'Practice', 'Confidence'].map(label => (
                      <div key={label} style={{ opacity: 0.55 }}>
                        <div className="flex items-center justify-between mb-1.5 text-label-sm font-semibold">
                          <span style={{ color: 'var(--text-muted)' }}>{label}</span><span style={{ color: 'var(--text-faint)' }}>—</span>
                        </div>
                        <div className="progress-bar"><div className="progress-bar-fill" style={{ width: '0%', backgroundColor: 'var(--text-faint)' }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Test Performance — real attempts when available, mock reports otherwise */}
        <Card title="Recent Test Performance" subtitle="Score, time and accuracy for each test">
          {recentAttempts.length > 0 ? (
            <div className="space-y-3">
              {recentAttempts.map((a, i) => {
                const older = attempts[i + 1];
                const delta = older ? a.accuracyPct - older.accuracyPct : null;
                return (
                  <div key={a.id} className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <div>
                        <div className="text-body-md font-bold" style={{ color: 'var(--text-primary)' }}>{a.testTitle ?? 'Test'}</div>
                        <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>
                          {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                        </div>
                      </div>
                      <div className="flex gap-5">
                        <div className="text-center">
                          <div className="text-base font-extrabold" style={{ color: 'var(--parent-accent)' }}>{a.score}</div>
                          <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-base font-extrabold" style={{ color: delta === null ? 'var(--text-faint)' : delta >= 0 ? '#10B981' : '#EF4444' }}>
                            {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                          </div>
                          <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>vs Previous</div>
                        </div>
                        <div className="text-center">
                          <div className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>{Math.round(a.timeSeconds / 60)}m</div>
                          <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>Time</div>
                        </div>
                        <div className="text-center">
                          <div className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>{a.accuracyPct}%</div>
                          <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>Accuracy</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-label-sm pt-2.5 italic" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border-muted)' }}>
                      Question-level analysis isn't available in the parent view yet.
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {(data.reports ?? []).map((r: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all hover:-translate-y-px"
                  style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(249,115,22,0.10)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--parent-accent)' }}>description</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body-md font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</div>
                    <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{r.date ?? r.period}</div>
                  </div>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: 'var(--text-faint)' }}>download</span>
                </div>
              ))}
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(234,88,12,0.06))', border: '1px solid rgba(249,115,22,0.15)' }}
              >
                <div className="text-lg font-bold font-headline mb-0.5" style={{ color: 'var(--parent-accent)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {data.latestPrediction}%
                </div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>AI predicted exam score</div>
              </div>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

function DailyUsageChart({ daily }: { daily: Array<{ date: string; label: string; seconds: number }> }) {
  const max = Math.max(1, ...daily.map(d => d.seconds));
  return (
    <div className="flex items-end justify-between gap-2 h-40 pt-2">
      {daily.map((d, i) => {
        const h = Math.round((d.seconds / max) * 100);
        const mins = Math.round(d.seconds / 60);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-faint)' }}>{mins > 0 ? `${mins}m` : ''}</span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: `${Math.max(2, h)}%`, minHeight: 2, background: d.seconds > 0 ? 'linear-gradient(180deg, var(--parent-accent), var(--parent-accent-hover))' : 'var(--border)' }}
              title={`${d.label}: ${formatDuration(d.seconds)}`}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
