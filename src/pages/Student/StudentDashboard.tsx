import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import { getDailyActivityMinutes } from '../../lib/activity';
import { getStudentDashboard, getStudentProgressData, getStudentStreamDB, type ProgressRecord } from '../../lib/db';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream, saveStreamLocal, STREAM_COLORS, STREAM_BG, type StudentStream } from '../../lib/stream';
import { formatExamCountdown } from '../../lib/examCountdown';
import {
  currentStudent,
  dashboardMetrics,
  subjectPerformance,
  weeklyProgress,
  heatmapCells,
  weakAreas,
  aiRecommendations,
} from '../../mocks/student';

const CHART_COLORS = ['#6B5EF0', '#8B5CF6', '#06B6D4'];

interface DashData {
  currentStudent: typeof currentStudent;
  metrics:        typeof dashboardMetrics;
  weeklyProgress: typeof weeklyProgress;
  subjectPerformance: typeof subjectPerformance;
  heatmapCells:   typeof heatmapCells;
  weakAreas:      typeof weakAreas;
  aiRecommendations: typeof aiRecommendations;
}

export default function StudentDashboard() {
  const session   = getAuthSession();
  const firstName = session?.user?.name?.split(' ')[0] ?? currentStudent.name.split(' ')[0];
  // Local cache first for instant paint; corrected against the student's
  // actual profile below in case this device/session never set it locally.
  const [stream, setStream] = useState<StudentStream | null>(getStudentStream());
  const [data, setData] = useState<DashData>({
    currentStudent, metrics: dashboardMetrics, weeklyProgress,
    subjectPerformance, heatmapCells, weakAreas, aiRecommendations,
  });
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [activityMap, setActivityMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStudentDashboard(session?.user?.id ?? '')
      .then(payload => { if (!cancelled) setData(payload as unknown as DashData); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    if (session?.user?.id) {
      getStudentProgressData(session.user.id)
        .then(p => { if (!cancelled) setProgress(p); })
        .catch(() => undefined);
      getDailyActivityMinutes(session.user.id)
        .then(m => { if (!cancelled) setActivityMap(m); })
        .catch(() => undefined);
      // Correct against the student's actual profile — covers a fresh
      // device/session where the local stream cache was never set.
      if (!getStudentStream()) {
        getStudentStreamDB(session.user.id)
          .then(dbStream => {
            if (cancelled || (dbStream !== 'JEE' && dbStream !== 'NEET')) return;
            saveStreamLocal(dbStream);
            setStream(dbStream);
          })
          .catch(() => undefined);
      }
    }
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const metricIconMap: Record<string, { icon: string; color: string; bg: string }> = {
    'Overall Score':     { icon: 'trending_up',   color: 'var(--brand)', bg: 'var(--brand-muted)' },
    'Current Rank':      { icon: 'military_tech', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    'Practice Streak':   { icon: 'local_fire_department', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    'Tests Completed':   { icon: 'fact_check',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Dashboard' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              {formatExamCountdown(stream)}
              {stream && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: stream === 'JEE' ? 'var(--brand-muted)' : 'rgba(20,184,166,0.12)', color: stream === 'JEE' ? 'var(--brand)' : '#14B8A6' }}>{stream}</span>}
            </p>
          </div>
          <Link
            to="/student/insights"
            className="hidden sm:flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold transition-all hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, rgba(107,94,240,0.12), rgba(124,58,237,0.12))', color: 'var(--brand)', border: '1px solid rgba(107,94,240,0.20)' }}
          >
            <span className="material-symbols-outlined filled" style={{ fontSize: '16px' }}>auto_awesome</span>
            AI Insights
          </Link>
        </div>

        {/* ── Mission hero — real recommendation + resume data, no fabricated content ── */}
        {(() => {
          const rec = data.aiRecommendations?.[0] as { title?: string; rationale?: string; subject?: string; durationMins?: number } | undefined;
          const missionTitle = rec?.title
            ?? (progress?.nextRecommendation ? `Next up: ${progress.nextRecommendation}` : 'Keep today\'s momentum going');
          const missionDesc = rec?.rationale
            ?? (progress?.lastActivity
              ? `Pick up where you left off — last time you scored ${progress.lastActivity.score ?? 0}% on ${progress.lastActivity.title}.`
              : 'Start a practice session to build today\'s momentum.');
          return (
            <div
              className="relative overflow-hidden rounded-2xl p-6 lg:p-8"
              style={{ background: 'linear-gradient(135deg, rgba(107,94,240,0.14) 0%, var(--surface) 55%)', border: '1px solid rgba(107,94,240,0.22)' }}
            >
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-16 w-56 h-56 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(107,94,240,0.25), transparent 70%)' }}
              />
              <div className="relative flex items-center justify-between gap-4 mb-3.5 flex-wrap">
                <div className="flex items-center gap-2 text-label-md font-bold uppercase tracking-widest" style={{ color: 'var(--brand)' }}>
                  <span className="material-symbols-outlined filled" style={{ fontSize: '16px' }}>auto_awesome</span>
                  Today's Mission
                </div>
                <div className="flex items-center gap-4 text-label-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {rec?.durationMins !== undefined && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>schedule</span>
                      {rec.durationMins} min
                    </span>
                  )}
                  {progress?.lastActivity?.completedAt && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>history</span>
                      {new Date(progress.lastActivity.completedAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
              <h2 className="relative text-headline-md font-headline mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                {missionTitle}
              </h2>
              <p className="relative text-body-md mb-5 max-w-xl" style={{ color: 'var(--text-muted)' }}>{missionDesc}</p>
              <div className="relative flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {rec?.subject && (
                    <span className="text-label-sm font-semibold px-3 py-1 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      {rec.subject}
                    </span>
                  )}
                  {progress?.nextRecommendation && rec?.title && (
                    <span className="text-label-sm font-semibold px-3 py-1 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      Next: {progress.nextRecommendation}
                    </span>
                  )}
                </div>
                <Link
                  to="/student/practice"
                  className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)', boxShadow: '0 8px 24px rgba(107,94,240,0.28)' }}
                >
                  Continue Learning
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>
          );
        })()}

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {data.metrics.map((m: any) => {
            const meta = metricIconMap[m.label] ?? { icon: 'insights', color: 'var(--brand)', bg: 'var(--brand-muted)' };
            const isPositive = m.trend > 0;
            return (
              <div key={m.label} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: meta.bg }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: meta.color }}>{meta.icon}</span>
                  </div>
                  {m.trend !== undefined && (
                    <span
                      className="inline-flex items-center gap-0.5 text-label-md px-2 py-0.5 rounded-full"
                      style={isPositive
                        ? { backgroundColor: 'rgba(16,185,129,0.10)', color: '#10B981' }
                        : { backgroundColor: 'rgba(239,68,68,0.10)', color: '#EF4444' }
                      }
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {isPositive ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                      {Math.abs(m.trend)}%
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold font-headline mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                  {m.value}
                </div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Weekly trend chart */}
          <Card
            title="Weekly Performance"
            subtitle="Last 7 days across subjects"
            action={
              <div className="flex items-center gap-3">
                {['Physics', 'Chemistry', stream === 'NEET' ? 'Biology' : 'Math'].map((s, i) => (
                  <div key={s} className="hidden md:flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                    <span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{s}</span>
                  </div>
                ))}
              </div>
            }
            className="lg:col-span-2"
          >
            <WeeklyAreaChart data={data.weeklyProgress} />
          </Card>

          {/* Subject mastery */}
          <Card title="Subject Mastery" subtitle="Accuracy by subject">
            <div className="space-y-5">
              {data.subjectPerformance
                .filter((s: any) => {
                  if (s.subject === 'English') return false;
                  if (stream === 'JEE')  return s.subject !== 'Biology';
                  return true; // NEET: keep Physics, Chemistry, Mathematics (renamed below)
                })
                .map((s: any) => {
                  const subjectName = (stream === 'NEET' && s.subject === 'Mathematics') ? 'Biology' : s.subject;
                  const color = STREAM_COLORS[subjectName] ?? 'var(--brand)';
                  const bg    = STREAM_BG[subjectName]    ?? 'var(--brand-muted)';
                  return (
                <div key={s.subject}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color }}>science</span>
                      </div>
                      <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{subjectName}</span>
                    </div>
                    <span className="text-label-lg font-bold" style={{ color }}>{s.pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill transition-all duration-700"
                      style={{ width: `${s.pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{s.correct ?? 0} correct</span>
                    <Link to="/student/analysis" className="text-label-sm hover:underline" style={{ color: 'var(--brand)' }}>Details →</Link>
                  </div>
                </div>
                  );
                })}
            </div>
          </Card>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Study activity calendar (LeetCode-style) */}
          <Card
            title="Study Activity"
            subtitle="Your daily study time over the last 6 months"
            className="lg:col-span-2"
          >
            <ActivityHeatmap data={activityMap} colorBase="#6B5EF0" unit="min" />
          </Card>

          {/* Weak areas */}
          <Card
            title="Weak Areas"
            subtitle="Topics needing immediate attention"
          >
            <div className="space-y-3">
              {data.weakAreas.slice(0, 5).map((w: any) => (
                <div
                  key={w.name}
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-150 hover:-translate-y-px"
                  style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-body-md font-medium truncate" style={{ color: 'var(--text-primary)' }}>{w.name}</p>
                    <p className="text-label-sm truncate" style={{ color: 'var(--text-muted)' }}>{w.note}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-label-lg font-bold" style={{ color: '#EF4444' }}>{w.percent}%</span>
                  </div>
                </div>
              ))}
              <Link
                to="/student/practice"
                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg text-sm font-semibold mt-1 transition-all hover:opacity-80"
                style={{ backgroundColor: 'rgba(107,94,240,0.08)', color: 'var(--brand)', border: '1px solid rgba(107,94,240,0.15)' }}
              >
                Practice weak topics
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </Link>
            </div>
          </Card>
        </div>

        {/* ── AI Recommendations ── */}
        <div>
          <div
            className="rounded-xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(107,94,240,0.08), rgba(124,58,237,0.05))',
              border: '1px solid rgba(107,94,240,0.20)',
              borderLeft: '3px solid var(--brand)',
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
              >
                <span className="material-symbols-outlined filled text-white" style={{ fontSize: '18px' }}>auto_awesome</span>
              </div>
              <div>
                <h3 className="text-title-lg font-semibold" style={{ color: 'var(--text-primary)' }}>AI Recommended Practice</h3>
                <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>Personalized based on your recent performance</p>
              </div>
              <Link
                to="/student/insights"
                className="ml-auto text-sm font-semibold hover:underline"
                style={{ color: 'var(--brand)' }}
              >
                View all insights →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.aiRecommendations.slice(0, 4).map((r: any) => (
                <Link
                  key={r.title}
                  to="/student/practice"
                  className="group rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand)' }}
                    >
                      {r.subject ?? 'Topic'}
                    </span>
                    <span
                      className="material-symbols-outlined transition-transform group-hover:translate-x-1"
                      style={{ fontSize: '18px', color: 'var(--text-faint)' }}
                    >
                      arrow_forward
                    </span>
                  </div>
                  <div>
                    <h4 className="text-body-md font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{r.title}</h4>
                    <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{r.rationale}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-auto">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-faint)' }}>schedule</span>
                    <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{r.durationMins} min</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WeeklyAreaChart (inline, no external dep) ────────────────────────────────
function WeeklyAreaChart({ data }: { data: any[] }) {
  if (!data?.length) return <div className="h-48 skeleton rounded-lg" />;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxVal = 100;
  const chartH = 160;
  const chartW = 600;
  const pad = { top: 10, right: 10, bottom: 30, left: 30 };

  const series = [
    { key: 'physics',   color: '#6B5EF0', label: 'Physics' },
    { key: 'chemistry', color: '#8B5CF6', label: 'Chemistry' },
    { key: 'math',      color: '#06B6D4', label: 'Math' },
  ];

  const pts = (key: string) => data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * (chartW - pad.left - pad.right);
    const v = d[key] ?? d.score ?? 60;
    const y = pad.top + (1 - v / maxVal) * (chartH - pad.top - pad.bottom);
    return [x, y] as [number, number];
  });

  function pathD(points: [number, number][]) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  }

  function areaD(points: [number, number][]) {
    const bottom = chartH - pad.bottom;
    return `${pathD(points)} L ${points[points.length - 1][0]} ${bottom} L ${points[0][0]} ${bottom} Z`;
  }

  return (
    <div className="w-full overflow-hidden" style={{ height: `${chartH + 16}px` }}>
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${chartH}px` }}
        aria-label="Weekly performance chart"
      >
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.00" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {[25, 50, 75].map(v => {
          const y = pad.top + (1 - v / maxVal) * (chartH - pad.top - pad.bottom);
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={chartW - pad.right} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={pad.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="var(--text-faint)">{v}</text>
            </g>
          );
        })}

        {/* Day labels */}
        {days.map((d, i) => {
          const x = pad.left + (i / (days.length - 1)) * (chartW - pad.left - pad.right);
          return <text key={d} x={x} y={chartH - 4} textAnchor="middle" fontSize="9" fill="var(--text-faint)">{d}</text>;
        })}

        {/* Area + lines */}
        {series.map(s => {
          const points = pts(s.key);
          return (
            <g key={s.key}>
              <path d={areaD(points)} fill={`url(#grad-${s.key})`} />
              <path d={pathD(points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

