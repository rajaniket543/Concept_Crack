import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { PageSkeleton, ErrorState } from '../../components/DataStates';
import { analysis } from '../../mocks/student';
import { pathFor } from '../../lib/pages';
import { apiRequest } from '../../lib/api';

export default function TestAnalysis() {
  const [data, setData] = useState<any>(analysis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<any>('/api/student/analysis/latest')
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const metrics = [
    { label: 'Global Rank', value: `#${data.rank}`, sub: `Top ${data.rankPercentile}% of ${(data.totalStudents / 1000).toFixed(1)}k`, icon: 'military_tech', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Accuracy',    value: `${data.accuracyPct}%`, sub: `${data.correctCount}/50 correct`,           icon: 'my_location',    color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Score',       value: `${data.score ?? data.correctCount * 4}`, sub: `Out of ${(data.totalStudents > 0 ? 200 : 200)}`,       icon: 'stars',          color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)' },
    { label: 'Time Taken',  value: `${data.timeMinutes}m`, sub: `${data.timeVsAvgMinutes}m faster than avg`, icon: 'timer',          color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  ];

  const donutTotal = (data.correctCount ?? 0) + (data.incorrectCount ?? 0) + (data.skippedCount ?? 0);
  const donutData = [
    { label: 'Correct',   count: data.correctCount   ?? 0, color: '#10B981' },
    { label: 'Incorrect', count: data.incorrectCount ?? 0, color: '#EF4444' },
    { label: 'Skipped',   count: data.skippedCount   ?? 0, color: '#9CA3AF' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Test Analysis' }]} />
        <div className="flex-1 p-6 lg:p-8 overflow-auto"><PageSkeleton /></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Test Analysis' }]} />
        <div className="flex-1 p-6 lg:p-8 overflow-auto"><ErrorState message="We couldn't load your test analysis." /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Test Analysis' }]}
        actions={
          <Link to={pathFor('exam')} className="btn-primary btn-md flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
            Retake Test
          </Link>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Test Analysis
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              {data.testTitle ?? 'JEE Full Syllabus Mock #3'} · {data.testDate ?? 'Dec 14, 2025'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-success">
              <span className="material-symbols-outlined filled" style={{ fontSize: '12px' }}>check_circle</span>
              Submitted
            </span>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map(m => (
            <div key={m.label} className="card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: m.bg }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: m.color }}>{m.icon}</span>
              </div>
              <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{m.value}</div>
              <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
              <div className="text-label-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Donut */}
          <Card title="Score Breakdown" subtitle="Correct vs incorrect vs skipped">
            <DonutChart data={donutData} total={donutTotal} />
            <div className="grid grid-cols-3 gap-3 mt-5">
              {donutData.map(d => (
                <div key={d.label} className="text-center">
                  <div className="text-xl font-bold font-headline" style={{ color: d.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{d.count}</div>
                  <div className="text-label-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Topic accuracy */}
          <Card title="Topic-wise Accuracy" subtitle="Breakdown by chapter" className="lg:col-span-2">
            <div className="space-y-3.5">
              {(data.topicAccuracy ?? []).map((t: any) => (
                <div key={t.topic}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-body-md" style={{ color: 'var(--text-primary)' }}>{t.topic}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-label-lg font-semibold" style={{ color: t.pct >= 70 ? '#10B981' : t.pct >= 40 ? '#F59E0B' : '#EF4444' }}>{t.pct}%</span>
                      <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{t.correct}/{t.total}</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${t.pct}%`, backgroundColor: t.pct >= 70 ? '#10B981' : t.pct >= 40 ? '#F59E0B' : '#EF4444', transition: 'width 0.7s ease' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Difficulty distribution + AI recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Difficulty breakdown */}
          <Card title="Difficulty Distribution" subtitle="Performance by question difficulty">
            <div className="space-y-4">
              {[
                { label: 'Easy',   pct: data.easyPct   ?? 82, color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
                { label: 'Medium', pct: data.mediumPct ?? 65, color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
                { label: 'Hard',   pct: data.hardPct   ?? 41, color: '#EF4444', bg: 'rgba(239,68,68,0.10)'  },
              ].map(d => (
                <div key={d.label} className="p-4 rounded-xl" style={{ backgroundColor: d.bg }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-body-md font-semibold" style={{ color: d.color }}>{d.label}</span>
                    <span className="text-headline-sm font-bold font-headline" style={{ color: d.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{d.pct}%</span>
                  </div>
                  <div className="progress-bar" style={{ backgroundColor: 'rgba(255,255,255,0.40)' }}>
                    <div className="progress-bar-fill" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* AI improvement suggestions */}
          <Card
            title="AI Improvement Plan"
            subtitle="Personalized next steps"
            action={
              <Link to="/student/insights" className="text-label-md font-semibold hover:underline" style={{ color: '#5B4FE8' }}>
                Full insights →
              </Link>
            }
            className="lg:col-span-2"
          >
            <div className="ai-panel mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#5B4FE8' }}>auto_awesome</span>
                <span className="text-label-lg font-semibold" style={{ color: 'var(--text-primary)' }}>AI Analysis Summary</span>
              </div>
              <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>
                Your performance in Organic Chemistry (48%) and Rotational Motion (52%) needs improvement. Focus on these topics for maximum rank improvement.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { topic: 'Organic Chemistry',  reason: 'Low accuracy on mechanism questions', priority: 'High',   icon: 'science',        color: '#EF4444' },
                { topic: 'Rotational Motion',  reason: 'Time spent too high per question',    priority: 'High',   icon: 'rotate_right',   color: '#F59E0B' },
                { topic: 'Differential Calc',  reason: 'Integration shortcuts missing',        priority: 'Medium', icon: 'calculate',      color: '#8B5CF6' },
                { topic: 'Ionic Equilibrium',  reason: 'Good accuracy but slow speed',         priority: 'Medium', icon: 'science',        color: '#06B6D4' },
              ].map(item => (
                <Link
                  key={item.topic}
                  to="/student/practice"
                  className="group flex items-start gap-3 p-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}15` }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: item.color }}>{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body-md font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{item.topic}</div>
                    <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{item.reason}</div>
                  </div>
                  <span
                    className="text-label-sm font-bold shrink-0"
                    style={{ color: item.priority === 'High' ? '#EF4444' : '#F59E0B' }}
                  >
                    {item.priority}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Inline DonutChart ────────────────────────────────────────────────────────
function DonutChart({ data, total }: { data: { label: string; count: number; color: string }[]; total: number }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 56;
  const strokeW = 16;

  let cumulative = 0;
  const segments = data.map(d => {
    const pct = total > 0 ? d.count / total : 0;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start };
  });

  function arc(start: number, end: number) {
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle   = end   * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = (end - start) > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const topScore = data[0];

  return (
    <div className="relative flex items-center justify-center" style={{ height: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Score donut chart">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeW} />
        {segments.map(seg => seg.pct > 0 && (
          <path
            key={seg.label}
            d={arc(seg.start, seg.start + seg.pct)}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <div className="text-xl font-bold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
          {topScore?.count ?? 0}
        </div>
        <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>correct</div>
      </div>
    </div>
  );
}
