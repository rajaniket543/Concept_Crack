import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { getStudentDashboard } from '../../lib/db';
import { getAuthSession } from '../../lib/auth';
import {
  currentStudent,
  dashboardMetrics,
  subjectPerformance,
  weeklyProgress,
  heatmapCells,
  weakAreas,
  aiRecommendations,
} from '../../mocks/student';

const CHART_COLORS = ['#5B4FE8', '#8B5CF6', '#06B6D4'];
const SUBJECT_COLORS: Record<string, string> = {
  Physics:     '#5B4FE8',
  Chemistry:   '#8B5CF6',
  Mathematics: '#10B981',
};
const SUBJECT_BG: Record<string, string> = {
  Physics:     'rgba(91,79,232,0.10)',
  Chemistry:   'rgba(139,92,246,0.10)',
  Mathematics: 'rgba(16,185,129,0.10)',
};

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
  const session = getAuthSession();
  const firstName = session?.user?.name?.split(' ')[0] ?? currentStudent.name.split(' ')[0];
  const [data, setData] = useState<DashData>({
    currentStudent, metrics: dashboardMetrics, weeklyProgress,
    subjectPerformance, heatmapCells, weakAreas, aiRecommendations,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStudentDashboard(session?.user?.id ?? '')
      .then(payload => { if (!cancelled) setData(payload as DashData); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const metricIconMap: Record<string, { icon: string; color: string; bg: string }> = {
    'Overall Score':     { icon: 'trending_up',   color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)' },
    'Current Rank':      { icon: 'military_tech', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    'Practice Streak':   { icon: 'local_fire_department', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    'Tests Completed':   { icon: 'fact_check',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Dashboard' }]}
        actions={
          <Link
            to="/student/exam"
            className="btn-primary btn-md flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.30)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>quiz</span>
            Take Mock Test
          </Link>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              {(data.currentStudent as any).examTarget ?? 'JEE 2025'} · {(data.currentStudent as any).daysToExam ?? 47} days remaining
            </p>
          </div>
          <Link
            to="/student/insights"
            className="hidden sm:flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold transition-all hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, rgba(91,79,232,0.12), rgba(124,58,237,0.12))', color: '#5B4FE8', border: '1px solid rgba(91,79,232,0.20)' }}
          >
            <span className="material-symbols-outlined filled" style={{ fontSize: '16px' }}>auto_awesome</span>
            AI Insights
          </Link>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {data.metrics.map((m: any) => {
            const meta = metricIconMap[m.label] ?? { icon: 'insights', color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)' };
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
                {['Physics', 'Chemistry', 'Math'].map((s, i) => (
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
              {data.subjectPerformance.map((s: any) => (
                <div key={s.subject}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: SUBJECT_BG[s.subject] ?? 'rgba(91,79,232,0.10)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: SUBJECT_COLORS[s.subject] ?? '#5B4FE8' }}>science</span>
                      </div>
                      <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                    </div>
                    <span className="text-label-lg font-bold" style={{ color: SUBJECT_COLORS[s.subject] ?? '#5B4FE8' }}>{s.pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill transition-all duration-700"
                      style={{ width: `${s.pct}%`, backgroundColor: SUBJECT_COLORS[s.subject] ?? '#5B4FE8' }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{s.correct ?? 0} correct</span>
                    <Link to="/student/analysis" className="text-label-sm hover:underline" style={{ color: '#5B4FE8' }}>Details →</Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Topic heatmap */}
          <Card
            title="Topic Mastery Heatmap"
            subtitle="Daily proficiency growth across all topics"
            action={
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>Low</span>
                {[0.15, 0.35, 0.60, 1].map((o, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(91,79,232,${o})` }} />
                ))}
                <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>High</span>
              </div>
            }
            className="lg:col-span-2"
          >
            <HeatmapGrid cells={data.heatmapCells} cols={12} />
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
                style={{ backgroundColor: 'rgba(91,79,232,0.08)', color: '#5B4FE8', border: '1px solid rgba(91,79,232,0.15)' }}
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
              background: 'linear-gradient(135deg, rgba(91,79,232,0.08), rgba(124,58,237,0.05))',
              border: '1px solid rgba(91,79,232,0.20)',
              borderLeft: '3px solid #5B4FE8',
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
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
                style={{ color: '#5B4FE8' }}
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
                      style={{ backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8' }}
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
    { key: 'physics',   color: '#5B4FE8', label: 'Physics' },
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

// ── HeatmapGrid (inline) ─────────────────────────────────────────────────────
function HeatmapGrid({ cells, cols = 12 }: { cells: any[]; cols?: number }) {
  const INTENSITIES = [
    'rgba(91,79,232,0.08)',
    'rgba(91,79,232,0.20)',
    'rgba(91,79,232,0.40)',
    'rgba(91,79,232,0.65)',
    'rgba(91,79,232,0.90)',
  ];

  return (
    <div
      className="grid gap-1 mt-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="img"
      aria-label="Topic mastery heatmap"
    >
      {cells.map((cell: any, i: number) => {
        const pct = cell.percent ?? cell.pct ?? 50;
        const idx = Math.min(Math.floor(pct / 20), 4);
        return (
          <div
            key={i}
            className="aspect-square rounded-sm transition-all duration-200 hover:scale-110 cursor-default"
            style={{ backgroundColor: INTENSITIES[idx] }}
            title={cell.tooltip ?? cell.topic ?? `Topic ${i + 1}: ${pct}%`}
          />
        );
      })}
    </div>
  );
}
