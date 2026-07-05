import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { parentActivity, parentGrowth, parentMastery, parentMetrics, parentReports } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { getLinkedStudentData, getStudentDashboard } from '../../lib/db';

export default function ParentDashboard() {
  const session = getAuthSession();

  const [data, setData] = useState<any>({
    metrics: parentMetrics,
    growth: parentGrowth,
    mastery: parentMastery,
    reports: parentReports,
    activity: parentActivity,
    latestPrediction: 94.5,
  });
  const [linkedStudent, setLinkedStudent] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) return;

    getLinkedStudentData(session.user.id).then(async stu => {
      if (cancelled) return;
      if (!stu) return;
      setLinkedStudent(stu);

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

      // Convert weekly data → growth chart (average across subjects per day)
      const realGrowth = (dash.weeklyProgress as Array<{ day: string; physics: number; chemistry: number; math: number }>).map(d => ({
        label: d.day,
        score: Math.round(((d.physics ?? 0) + (d.chemistry ?? 0) + (d.math ?? 0)) / 3),
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
        growth:            realGrowth,
        activity:          realActivity.length > 0 ? realActivity : parentActivity,
        reports:           parentReports,
        latestPrediction,
      });
    }).catch(() => undefined);

    return () => { cancelled = true; };
  }, []);

  const metricMeta = [
    { icon: 'score',           color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
    { icon: 'military_tech',   color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
    { icon: 'calendar_month',  color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { icon: 'trending_up',     color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  ];

  const subjectColors: Record<string, string> = { Physics: '#F97316', Chemistry: '#EA580C', Mathematics: '#10B981' };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Parent Dashboard' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Parent Dashboard
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Read-only view of your child's performance, attendance, and academic growth
          </p>
        </div>

        {/* Child info banner */}
        {(() => {
          const childName    = linkedStudent?.name    ?? 'Arjun Sharma';
          const childStream  = linkedStudent?.stream  ?? 'JEE';
          const childTarget  = linkedStudent?.examTarget ?? 'JEE 2025';
          const childRank    = linkedStudent?.rank    ?? 247;
          const childScore   = linkedStudent?.score   ?? 92;
          const initials     = childName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div
              className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(234,88,12,0.06))', border: '1px solid rgba(249,115,22,0.20)', borderLeft: '3px solid #F97316' }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg shrink-0" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
                {initials}
              </div>
              <div className="flex-1">
                <div className="text-headline-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                  {childName}
                </div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                  {childStream} · {childTarget} · Rank: #{childRank} · Score: {childScore}%
                </div>
                {linkedStudent?.progress?.lastActivity && (
                  <div className="text-label-sm mt-0.5" style={{ color: '#F97316' }}>
                    Last activity: {linkedStudent.progress.lastActivity.title}
                    {linkedStudent.progress.lastActivity.score !== undefined && ` — ${linkedStudent.progress.lastActivity.score}%`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-success">
                  <span className="material-symbols-outlined filled" style={{ fontSize: '12px' }}>trending_up</span>
                  On track
                </span>
                <span className="text-label-sm px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(249,115,22,0.10)', color: '#EA580C' }}>
                  47 days to exam
                </span>
              </div>
            </div>
          );
        })()}

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {data.metrics.map((m: any, i: number) => {
            const meta = metricMeta[i] ?? metricMeta[0];
            const isPositive = (m.trend ?? 0) > 0;
            return (
              <div key={m.label} className="card">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: meta.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: meta.color }}>{meta.icon}</span>
                </div>
                <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{m.value}</div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                {m.trend !== undefined && (
                  <div className="flex items-center gap-1 mt-1.5 text-label-sm" style={{ color: isPositive ? '#10B981' : '#EF4444' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{isPositive ? 'arrow_upward' : 'arrow_downward'}</span>
                    {Math.abs(m.trend)}% this month
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Growth chart + subject mastery */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="Academic Growth" subtitle="Monthly score progression" className="lg:col-span-2">
            <GrowthChart data={data.growth} />
          </Card>

          <Card title="Subject Mastery" subtitle="Current accuracy by subject">
            <div className="space-y-5">
              {(data.mastery ?? []).map((s: any) => {
                const color = subjectColors[s.subject] ?? '#5B4FE8';
                return (
                  <div key={s.subject}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                      <span className="text-label-lg font-bold" style={{ color }}>{s.pct ?? s.mastery}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${s.pct ?? s.mastery}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Activity feed + reports */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="Recent Activity" subtitle="Last 7 days" className="lg:col-span-2">
            <div className="space-y-3">
              {(data.activity ?? []).map((a: any, i: number) => {
                const typeIcon: Record<string, { icon: string; color: string }> = {
                  test:     { icon: 'quiz',          color: '#F97316' },
                  practice: { icon: 'edit_note',     color: '#10B981' },
                  login:    { icon: 'login',         color: '#6B7280' },
                  insights: { icon: 'auto_awesome',  color: '#F97316' },
                };
                const meta = typeIcon[a.type ?? 'test'] ?? typeIcon.test;
                return (
                  <div key={i} className="flex items-center gap-4 py-2.5" style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: meta.color }}>{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-md font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title ?? a.description}</div>
                      <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{a.time ?? a.date}</div>
                    </div>
                    {a.score !== undefined && (
                      <span className="text-label-lg font-bold shrink-0" style={{ color: '#F97316' }}>{a.score}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Reports */}
          <Card title="Performance Reports" subtitle="AI-generated weekly summaries">
            <div className="space-y-3">
              {(data.reports ?? []).map((r: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all hover:-translate-y-px"
                  style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(249,115,22,0.10)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#F97316' }}>description</span>
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
                <div className="text-lg font-bold font-headline mb-0.5" style={{ color: '#F97316', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {data.latestPrediction}%
                </div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>AI predicted exam score</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GrowthChart({ data }: { data: any[] }) {
  if (!data?.length) return <div className="h-40 skeleton rounded-lg" />;
  const W = 500; const H = 120;
  const pad = { t: 10, r: 10, b: 24, l: 30 };
  const maxVal = 100;

  const pts = data.map((d, i) => {
    const x = pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
    const v = d.score ?? d.avg ?? d.value ?? 70;
    const y = pad.t + (1 - v / maxVal) * (H - pad.t - pad.b);
    return [x, y] as [number, number];
  });

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[pts.length-1][0]} ${H-pad.b} L ${pts[0][0]} ${H-pad.b} Z`;
  const labels = data.map(d => d.month ?? d.label ?? '');

  return (
    <div style={{ height: `${H + 8}px` }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: `${H}px` }}>
        <defs>
          <linearGradient id="parent-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map(v => {
          const y = pad.t + (1 - v / maxVal) * (H - pad.t - pad.b);
          return <line key={v} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />;
        })}
        {labels.map((l, i) => {
          const x = pad.l + (i / (labels.length - 1)) * (W - pad.l - pad.r);
          return <text key={l} x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-faint)">{l}</text>;
        })}
        <path d={area} fill="url(#parent-grad)" />
        <path d={line} fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#F97316" stroke="var(--surface)" strokeWidth="2" />)}
      </svg>
    </div>
  );
}
