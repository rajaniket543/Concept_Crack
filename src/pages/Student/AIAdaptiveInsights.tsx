import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import {
  insightsProfile,
  revisionPriorities,
  genInsightsHeatmap,
  type InsightsMetric,
} from '../../mocks/student';
import { pathFor } from '../../lib/pages';
import { apiRequest } from '../../lib/api';

type Scope = 'Institution' | 'Cohort A' | 'Individual';

const METRIC_COLORS: Record<InsightsMetric['tone'], { color: string; bg: string }> = {
  primary:   { color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)' },
  secondary: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  tertiary:  { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
};

const PRIORITY_META: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', label: 'Critical' },
  high:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', label: 'High' },
  medium:   { color: '#5B4FE8', bg: 'rgba(91,79,232,0.10)', label: 'Medium' },
  done:     { color: '#10B981', bg: 'rgba(16,185,129,0.10)', label: 'Done' },
};

// Each scope shows genuinely different analysis so the tabs are meaningful.
interface ScopeMetric { label: string; value: number; sub: string; tone: InsightsMetric['tone']; }
const SCOPE_INFO: Record<Scope, { context: string; summary: string; metrics: ScopeMetric[] }> = {
  'Institution': {
    context: 'Institution-wide averages across all batches',
    summary: 'Across the institution, average learning speed is 74% with strong retention at 88%. Organic Chemistry is the most common weak area institution-wide — a targeted revision drive here could lift the overall average by ~6%.',
    metrics: [
      { label: 'Learning Speed',    value: 74, sub: 'Institution average',      tone: 'primary'   },
      { label: 'Consistency Score', value: 69, sub: 'Across all batches',        tone: 'secondary' },
      { label: 'Retention Score',   value: 88, sub: 'Spaced-repetition average', tone: 'tertiary'  },
    ],
  },
  'Cohort A': {
    context: 'Your batch — Cohort A (42 students)',
    summary: 'Within Cohort A you rank in the top 18%. Your batch is strongest in Physics (Mechanics) and weakest in Organic Chemistry. Peers who cleared reaction mechanisms gained an average of 120 ranks last month.',
    metrics: [
      { label: 'Learning Speed',    value: 82, sub: 'Top 12% in cohort',        tone: 'primary'   },
      { label: 'Consistency Score', value: 71, sub: 'Cohort average: 66%',      tone: 'secondary' },
      { label: 'Retention Score',   value: 90, sub: 'Above cohort average',     tone: 'tertiary'  },
    ],
  },
  'Individual': {
    context: 'Your personal performance — last 14 days',
    summary: 'Based on your last 14 days of activity, your strongest area is Mathematics (81%). Your biggest opportunity is Organic Chemistry — improving this alone could move you up 150+ ranks. Focus on reaction mechanisms and named reactions this week.',
    metrics: [
      { label: 'Learning Speed',    value: 82, sub: 'Personal best streak',     tone: 'primary'   },
      { label: 'Consistency Score', value: 68, sub: 'Maintaining 4-day streak', tone: 'secondary' },
      { label: 'Retention Score',   value: 91, sub: 'Spaced repetition optimal', tone: 'tertiary' },
    ],
  },
};

export default function AIAdaptiveInsights() {
  const [scope, setScope] = useState<Scope>('Institution');
  const [cells, setCells] = useState(genInsightsHeatmap(72));
  const [profile, setProfile] = useState(insightsProfile);
  const [priorities, setPriorities] = useState(revisionPriorities);

  useEffect(() => {
    void apiRequest<{
      insightsProfile: typeof insightsProfile;
      revisionPriorities: typeof revisionPriorities;
      knowledgeGapHeatmap: ReturnType<typeof genInsightsHeatmap>;
    }>('/api/student/insights')
      .then(payload => {
        setProfile(payload.insightsProfile);
        setPriorities(payload.revisionPriorities);
        setCells(payload.knowledgeGapHeatmap);
      })
      .catch(() => {
        setProfile(insightsProfile);
        setPriorities(revisionPriorities);
        setCells(genInsightsHeatmap(72));
      });
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'AI Insights' }]}
        actions={
          <Link to={pathFor('practice')} className="btn-primary btn-md flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_note</span>
            Start Practice
          </Link>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                <span className="material-symbols-outlined filled text-white" style={{ fontSize: '18px' }}>auto_awesome</span>
              </div>
              <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                AI Insights
              </h1>
            </div>
            <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>
              Adaptive analysis of your learning patterns and personalized recommendations
            </p>
          </div>
          {/* Scope toggle */}
          <div className="tab-pills">
            {(['Institution', 'Cohort A', 'Individual'] as Scope[]).map(s => (
              <button key={s} type="button" onClick={() => setScope(s)} className={`tab-pill ${scope === s ? 'active' : ''}`}>{s}</button>
            ))}
          </div>
        </div>

        {/* AI summary banner */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(91,79,232,0.08), rgba(124,58,237,0.06))',
            border: '1px solid rgba(91,79,232,0.20)',
            borderLeft: '3px solid #5B4FE8',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
            >
              <span className="material-symbols-outlined filled text-white" style={{ fontSize: '20px' }}>auto_awesome</span>
            </div>
            <div>
              <h3 className="text-title-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                AI Performance Summary — {scope}
              </h3>
              <p className="text-label-sm font-semibold uppercase tracking-widest mb-2" style={{ color: '#5B4FE8' }}>
                {SCOPE_INFO[scope].context}
              </p>
              <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>
                {SCOPE_INFO[scope].summary}
              </p>
            </div>
          </div>
        </div>

        {/* Metric circles — vary by selected scope */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {SCOPE_INFO[scope].metrics.map((m) => {
            const meta = METRIC_COLORS[m.tone];
            return (
              <Card key={m.label} className="text-center">
                <CircularProgressMeter value={m.value} color={meta.color} size={96} />
                <div className="text-title-lg font-semibold mt-3 mb-0.5" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {m.label}
                </div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.sub}</div>
              </Card>
            );
          })}
        </div>

        {/* Heatmap + revision priorities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card
            title="Knowledge Gap Heatmap"
            subtitle="Mastery level across all topics"
            action={
              <div className="flex items-center gap-1.5">
                {[0.10, 0.30, 0.55, 0.85].map((o, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(91,79,232,${o})` }} />
                ))}
                <span className="text-label-sm ml-1" style={{ color: 'var(--text-faint)' }}>Mastery</span>
              </div>
            }
            className="lg:col-span-2"
          >
            <InsightsHeatmap cells={cells} cols={12} />
          </Card>

          <Card title="Revision Priorities" subtitle="AI-ranked topics to review">
            <div className="space-y-2.5">
              {priorities.slice(0, 7).map((p: any) => {
                const meta = PRIORITY_META[p.priority?.toLowerCase()] ?? PRIORITY_META.medium;
                return (
                  <div
                    key={p.topic}
                    className="flex items-center gap-3 p-3 rounded-lg transition-all hover:-translate-y-px cursor-pointer"
                    style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}20` }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.topic}</p>
                      <p className="text-label-sm truncate" style={{ color: 'var(--text-muted)' }}>{p.note ?? p.subject}</p>
                    </div>
                    <span className="text-label-sm font-bold shrink-0" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link
              to={pathFor('practice')}
              className="flex items-center justify-center gap-2 w-full h-9 rounded-lg mt-4 text-sm font-semibold transition-all hover:opacity-80"
              style={{ backgroundColor: 'rgba(91,79,232,0.08)', color: '#5B4FE8', border: '1px solid rgba(91,79,232,0.15)' }}
            >
              Practice all weak topics
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </Link>
          </Card>
        </div>

        {/* Learning trend */}
        <Card title="30-Day Learning Trend" subtitle="Daily score improvement over time">
          <LearningTrendChart />
        </Card>
      </div>
    </div>
  );
}

// ── Circular Progress Meter ──────────────────────────────────────────────────
function CircularProgressMeter({ value, color, size = 96 }: { value: number; color: string; size?: number }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDash = (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={size * 0.08} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={size * 0.08}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color }}>
          {value}%
        </span>
      </div>
    </div>
  );
}

// ── Insights Heatmap ─────────────────────────────────────────────────────────
function InsightsHeatmap({ cells, cols }: { cells: any[]; cols: number }) {
  const LEVELS = ['rgba(91,79,232,0.06)', 'rgba(91,79,232,0.18)', 'rgba(91,79,232,0.38)', 'rgba(91,79,232,0.62)', 'rgba(91,79,232,0.90)'];
  return (
    <div className="grid gap-1.5 mt-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {cells.map((c: any, i: number) => {
        const pct = c.percent ?? c.pct ?? 50;
        const lvl = Math.min(Math.floor(pct / 20), 4);
        return (
          <div
            key={i}
            className="aspect-square rounded-sm transition-all hover:scale-110 cursor-default"
            style={{ backgroundColor: LEVELS[lvl] }}
            title={c.tooltip ?? c.topic ?? `Topic ${i + 1}: ${pct}%`}
          />
        );
      })}
    </div>
  );
}

// ── Learning Trend Chart ─────────────────────────────────────────────────────
function LearningTrendChart() {
  const days = 30;
  const data = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    score: 55 + Math.round(Math.sin(i * 0.4) * 8 + i * 0.6 + Math.random() * 5),
  }));

  const maxScore = 100;
  const W = 600; const H = 120;
  const pad = { t: 10, r: 10, b: 24, l: 30 };

  const pts = data.map((d, i) => {
    const x = pad.l + (i / (days - 1)) * (W - pad.l - pad.r);
    const y = pad.t + (1 - d.score / maxScore) * (H - pad.t - pad.b);
    return [x, y] as [number, number];
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${H - pad.b} L ${pts[0][0]} ${H - pad.b} Z`;

  return (
    <div className="w-full" style={{ height: `${H + 8}px` }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: `${H}px` }}>
        <defs>
          <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B4FE8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#5B4FE8" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map(v => {
          const y = pad.t + (1 - v / maxScore) * (H - pad.t - pad.b);
          return <line key={v} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />;
        })}
        <path d={areaPath} fill="url(#trend-grad)" />
        <path d={linePath} fill="none" stroke="#5B4FE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Current point */}
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#5B4FE8" stroke="white" strokeWidth="2" />
      </svg>
    </div>
  );
}
