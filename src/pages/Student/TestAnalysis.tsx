import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { pathFor } from '../../lib/pages';
import { getStudentProgressData, type TestResult } from '../../lib/db';
import { getAuthSession } from '../../lib/auth';

export default function TestAnalysis() {
  const navigate = useNavigate();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = getAuthSession()?.user?.id;
    if (!uid) { setLoading(false); return; }

    void getStudentProgressData(uid).then(progress => {
      setResult(progress?.latestTestResult ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Test Analysis' }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: '#5B4FE8', borderTopColor: 'transparent' }} />
            <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>Loading your results…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Test Analysis' }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">assignment</span>
            </div>
            <h3 className="empty-state-title">No tests completed yet</h3>
            <p className="empty-state-body">Complete a practice session from the Practice page to see your analysis here.</p>
            <Link to="/student/practice" className="btn-primary btn-md mt-4">Go to Practice</Link>
          </div>
        </div>
      </div>
    );
  }

  const donutData = [
    { label: 'Correct',   count: result.correctCount,   color: '#10B981' },
    { label: 'Incorrect', count: result.incorrectCount, color: '#EF4444' },
    { label: 'Skipped',   count: result.skippedCount,   color: '#9CA3AF' },
  ];
  const donutTotal = result.correctCount + result.incorrectCount + result.skippedCount;

  const metrics = [
    {
      label: 'Accuracy',
      value: `${result.accuracyPct}%`,
      sub:   `${result.correctCount}/${result.totalQuestions} correct`,
      icon:  'my_location', color: '#10B981', bg: 'rgba(16,185,129,0.12)',
    },
    {
      label: 'Score',
      value: String(result.score),
      sub:   `Out of ${result.totalQuestions * 4}`,
      icon:  'stars', color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)',
    },
    {
      label: 'Time Taken',
      value: `${result.timeMinutes}m`,
      sub:   `${result.totalQuestions} questions`,
      icon:  'timer', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',
    },
    {
      label: 'Questions',
      value: String(result.totalQuestions),
      sub:   `${result.skippedCount} skipped`,
      icon:  'quiz', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',
    },
  ];

  const weakTopics = result.topicAccuracy
    .filter(t => t.pct < 70)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Test Analysis' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(pathFor('chatbot'), {
                state: {
                  correctCount:   result.correctCount,
                  incorrectCount: result.incorrectCount,
                  skippedCount:   result.skippedCount,
                  accuracyPct:    result.accuracyPct,
                  score:          result.score,
                },
              })}
              className="btn-outline btn-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined filled" style={{ fontSize: '18px' }}>smart_toy</span>
              Ask AI Tutor
            </button>
            <Link to={pathFor('practice')} className="btn-primary btn-md flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
              Practice Again
            </Link>
          </div>
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
              {result.testTitle} · {result.testDate}
            </p>
          </div>
          <span className="badge badge-success self-start sm:self-auto">
            <span className="material-symbols-outlined filled" style={{ fontSize: '12px' }}>check_circle</span>
            Submitted
          </span>
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
            {result.topicAccuracy.length > 0 ? (
              <div className="space-y-3.5">
                {result.topicAccuracy.map(t => (
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
            ) : (
              <p className="text-body-sm" style={{ color: 'var(--text-faint)' }}>No topic data available.</p>
            )}
          </Card>
        </div>

        {/* Difficulty + AI suggestions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="Difficulty Distribution" subtitle="Performance by question difficulty">
            <div className="space-y-4">
              {[
                { label: 'Easy',   pct: result.easyPct,   color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
                { label: 'Medium', pct: result.mediumPct, color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
                { label: 'Hard',   pct: result.hardPct,   color: '#EF4444', bg: 'rgba(239,68,68,0.10)'  },
              ].map(d => (
                <div key={d.label} className="p-4 rounded-xl" style={{ backgroundColor: d.bg }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-body-md font-semibold" style={{ color: d.color }}>{d.label}</span>
                    <span className="text-headline-sm font-bold font-headline" style={{ color: d.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      {d.pct > 0 ? `${d.pct}%` : '—'}
                    </span>
                  </div>
                  {d.pct > 0 && (
                    <div className="progress-bar" style={{ backgroundColor: 'rgba(255,255,255,0.40)' }}>
                      <div className="progress-bar-fill" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
                    </div>
                  )}
                  {d.pct === 0 && (
                    <p className="text-label-sm" style={{ color: d.color, opacity: 0.6 }}>No {d.label.toLowerCase()} questions</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

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
                {result.accuracyPct >= 80
                  ? `Excellent performance on ${result.chapter}! You scored ${result.accuracyPct}% accuracy. Keep up the momentum and move to the next chapter.`
                  : result.accuracyPct >= 50
                  ? `Good effort on ${result.chapter}. You scored ${result.accuracyPct}% accuracy. Review the ${result.incorrectCount} incorrect answers to improve further.`
                  : `${result.chapter} needs more practice. You scored ${result.accuracyPct}% accuracy. Revisit the fundamentals and try again.`
                }
              </p>
            </div>

            {weakTopics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weakTopics.map(t => (
                  <Link
                    key={t.topic}
                    to="/student/practice"
                    className="group flex items-start gap-3 p-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                    style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#EF4444' }}>priority_high</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-md font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{t.topic}</div>
                      <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{t.correct}/{t.total} correct · {t.pct}% accuracy</div>
                    </div>
                    <span className="text-label-sm font-bold shrink-0" style={{ color: '#EF4444' }}>Revise</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: '24px', color: '#10B981' }}>verified</span>
                <p className="text-body-md font-semibold" style={{ color: '#10B981' }}>
                  Great job! All topics are above 70% accuracy.
                </p>
              </div>
            )}
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
