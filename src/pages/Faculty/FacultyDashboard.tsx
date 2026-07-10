import { useEffect, useState } from 'react';
import Spinner from '../../components/Spinner';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { facultyTrend } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { getAssignedStudentsData, type MockStudentProfile } from '../../lib/db';
import { formatExamCountdown } from '../../lib/examCountdown';
import type { StudentStream } from '../../lib/stream';

const asStream = (s: string): StudentStream => (s === 'NEET' ? 'NEET' : 'JEE');

interface RealMetric { label: string; value: string; }

export default function FacultyDashboard() {
  const session = getAuthSession();

  const [metrics, setMetrics] = useState<RealMetric[]>([
    { label: 'My Students',      value: '—' },
    { label: 'My Tests',         value: '—' },
    { label: 'Questions Added',  value: '—' },
    { label: 'Avg Accuracy',     value: '—' },
  ]);
  const [trend] = useState(facultyTrend);
  const [alerts, setAlerts] = useState<Array<{ name: string; initials: string; message: string; severity: string }>>([]);
  const [curriculumGap, setCurriculumGap] = useState<{ headline: string; focusAreas: string[] }>({
    headline: 'Attempt data will surface the chapters your students struggle with most.',
    focusAreas: [],
  });
  const [assignedStudents, setAssignedStudents] = useState<MockStudentProfile[]>([]);
  const [loadingStudents,  setLoadingStudents]  = useState(true);
  const [batchStream,      setBatchStream]      = useState<string>('');
  const [submissionsByDay, setSubmissionsByDay] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;
    if (!uid) { setLoadingStudents(false); return; }

    // Real faculty metrics from Firestore
    (async () => {
      try {
        const [testSnap, qSnap] = await Promise.all([
          getDocs(query(collection(db, 'tests'), where('createdBy', '==', uid))),
          getDocs(query(collection(db, 'questions'), where('uploadedBy', '==', uid))),
        ]);
        const testIds = new Set(testSnap.docs.map(d => d.id));
        // Attempts on this faculty's tests
        const attemptSnap = await getDocs(collection(db, 'testAttempts'));
        const myAttempts = attemptSnap.docs.map(d => d.data()).filter(a => testIds.has(a.testId as string));
        const accs = myAttempts.map(a => (a.accuracyPct as number) ?? 0);
        const avg = accs.length > 0 ? Math.round(accs.reduce((s, v) => s + v, 0) / accs.length) : 0;

        // Daily submission counts for the contribution calendar
        const byDay: Record<string, number> = {};
        myAttempts.forEach(a => {
          const raw = a.submittedAt;
          const d = raw instanceof Timestamp ? raw.toDate() : typeof raw === 'string' ? new Date(raw) : null;
          if (!d || isNaN(d.getTime())) return;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          byDay[key] = (byDay[key] ?? 0) + 1;
        });
        if (!cancelled) setSubmissionsByDay(byDay);

        // Weakest chapters across this faculty's tests
        const chapterAvg = new Map<string, { total: number; count: number }>();
        myAttempts.forEach(a => {
          const test = testSnap.docs.find(t => t.id === (a.testId as string));
          ((test?.data().chapters as string[]) ?? []).forEach(ch => {
            const cur = chapterAvg.get(ch) ?? { total: 0, count: 0 };
            cur.total += (a.accuracyPct as number) ?? 0;
            cur.count += 1;
            chapterAvg.set(ch, cur);
          });
        });
        const focus = [...chapterAvg.entries()]
          .map(([ch, { total, count }]) => ({ ch, avg: total / count }))
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 3);

        if (cancelled) return;
        setMetrics([
          { label: 'My Tests',        value: String(testSnap.size) },
          { label: 'Questions Added', value: String(qSnap.size) },
          { label: 'Attempts',        value: String(myAttempts.length) },
          { label: 'Avg Accuracy',    value: `${avg}%` },
        ]);
        if (focus.length > 0) {
          setCurriculumGap({
            headline: `${focus[0].ch} has the lowest average accuracy (${Math.round(focus[0].avg)}%) across your tests.`,
            focusAreas: focus.map(f => f.ch),
          });
        }
      } catch (e) {
        console.error('faculty metrics load failed', e);
      }
    })();

    getAssignedStudentsData(uid)
      .then(students => {
        if (cancelled) return;
        setAssignedStudents(students);
        setLoadingStudents(false);
        if (students.length > 0) setBatchStream(students[0].stream);
        // Real "students needing attention" — lowest scorers
        const weak = [...students]
          .filter(s => (s.progress?.latestTestResult?.accuracyPct ?? s.accuracy ?? 100) < 60)
          .sort((a, b) => (a.progress?.latestTestResult?.accuracyPct ?? a.accuracy) - (b.progress?.latestTestResult?.accuracyPct ?? b.accuracy))
          .slice(0, 5)
          .map(s => ({
            name: s.name,
            initials: s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
            message: `Accuracy ${s.progress?.latestTestResult?.accuracyPct ?? s.accuracy}% — may need support`,
            severity: (s.progress?.latestTestResult?.accuracyPct ?? s.accuracy) < 40 ? 'critical' : 'warning',
          }));
        setAlerts(weak);
      })
      .catch(() => { if (!cancelled) setLoadingStudents(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metricMeta = [
    { icon: 'quiz',         color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
    { icon: 'library_books',color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { icon: 'assignment_turned_in', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { icon: 'target',       color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Faculty Dashboard' }]}
        actions={
          <Link
            to={pathFor('questionBank')}
            className="btn-primary btn-md flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>library_books</span>
            Question Bank
          </Link>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Academic Overview
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            {batchStream ? `${batchStream} Batch` : 'My Batch'} · {assignedStudents.length > 0 ? `${assignedStudents.length} students assigned` : 'Loading students…'} · Batch performance and student insights
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((m, i) => {
            const meta = metricMeta[i] ?? metricMeta[0];
            return (
              <div key={m.label} className="card">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: meta.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: meta.color }}>{meta.icon}</span>
                </div>
                <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{m.value}</div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* Submission activity calendar (LeetCode-style) */}
        <Card title="Test Submission Activity" subtitle="Attempts on your tests per day over the last 6 months">
          <ActivityHeatmap data={submissionsByDay} colorBase="#14B8A6" unit="submission" />
        </Card>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Batch trend */}
          <Card title="Batch Performance Trend" subtitle="Average score over last 8 weeks" className="lg:col-span-2">
            <BatchTrendChart data={trend} />
          </Card>

          {/* Curriculum gap */}
          <Card title="AI Curriculum Gap Alert" subtitle="Topics needing immediate attention">
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.06))', border: '1px solid rgba(239,68,68,0.20)', borderLeft: '3px solid #EF4444' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#EF4444' }}>warning</span>
                <span className="text-label-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Gap Identified</span>
              </div>
              <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>{curriculumGap.headline}</p>
            </div>
            <div className="space-y-2">
              <p className="text-label-sm font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>Focus Areas</p>
              {curriculumGap.focusAreas.length === 0 && (
                <p className="text-body-sm" style={{ color: 'var(--text-faint)' }}>No weak chapters yet — they'll appear as students attempt your tests.</p>
              )}
              {curriculumGap.focusAreas.map((area: string, i: number) => {
                const colors = ['#EF4444', '#F59E0B', '#14B8A6'];
                return (
                  <div key={area} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)' }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                    <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{area}</span>
                    <Link to={pathFor('questionBank')} className="ml-auto text-label-sm font-semibold hover:underline" style={{ color: '#14B8A6' }}>Assign →</Link>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Alerts + student table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Student alerts */}
          <Card title="Student Alerts" subtitle="Students needing attention" action={<span className="badge badge-danger">{alerts.length} alerts</span>}>
            <div className="space-y-3">
              {alerts.length === 0 && (
                <p className="text-body-sm py-6 text-center" style={{ color: 'var(--text-faint)' }}>No students flagged — everyone's above 60% accuracy.</p>
              )}
              {alerts.slice(0, 5).map((alert, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl"
                  style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}>
                    {alert.initials ?? (alert.name?.slice(0, 2) ?? 'ST')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body-md font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{alert.name}</div>
                    <div className="text-body-sm truncate" style={{ color: 'var(--text-muted)' }}>{alert.message ?? 'Performance dip detected'}</div>
                  </div>
                  <span
                    className="text-label-sm font-bold shrink-0"
                    style={{ color: alert.severity === 'critical' ? '#EF4444' : '#F59E0B' }}
                  >
                    {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Assigned student list */}
          <Card
            title={`My Students${batchStream ? ` — ${batchStream}` : ''}`}
            subtitle={`${assignedStudents.length} students assigned to you`}
            className="lg:col-span-2"
            noPad
          >
            {loadingStudents ? (
              <div className="flex items-center justify-center h-32">
                <Spinner size={28} color="#14B8A6" />
              </div>
            ) : assignedStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--text-faint)' }}>group_off</span>
                <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>No students assigned yet. An admin can assign students to your batch.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Stream</th>
                      <th>Score</th>
                      <th>Accuracy</th>
                      <th>Rank</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedStudents.map((s, i) => {
                      const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                      const statusColor = s.accuracy >= 80 ? '#10B981' : s.accuracy >= 65 ? '#F59E0B' : '#EF4444';
                      return (
                        <tr key={s.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}>
                                {initials}
                              </div>
                              <div>
                                <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                                <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{formatExamCountdown(asStream(s.stream))}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="text-label-sm font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: s.stream === 'JEE' ? 'rgba(91,79,232,0.10)' : 'rgba(20,184,166,0.10)', color: s.stream === 'JEE' ? '#5B4FE8' : '#14B8A6' }}>
                              {s.stream}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="progress-bar w-14">
                                <div className="progress-bar-fill" style={{ width: `${s.score}%`, backgroundColor: '#14B8A6' }} />
                              </div>
                              <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.score}%</span>
                            </div>
                          </td>
                          <td><span style={{ color: 'var(--text-secondary)' }}>{s.accuracy}%</span></td>
                          <td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>#{s.rank}</span></td>
                          <td>
                            <Link
                              to={`/faculty/student/${s.id}`}
                              className="text-label-sm font-semibold px-3 py-1 rounded-lg transition-all hover:-translate-y-px"
                              style={{ backgroundColor: 'rgba(20,184,166,0.10)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.20)' }}
                            >
                              View →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function BatchTrendChart({ data }: { data: any[] }) {
  if (!data?.length) return <div className="h-40 skeleton rounded-lg" />;
  const weeks = data.map((_, i) => `W${i + 1}`);
  const maxVal = 100;
  const W = 500; const H = 120;
  const pad = { t: 10, r: 10, b: 24, l: 30 };

  const pts = data.map((d, i) => {
    const x = pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
    const v = d.avg ?? d.score ?? d.value ?? 65;
    const y = pad.t + (1 - v / maxVal) * (H - pad.t - pad.b);
    return [x, y] as [number, number];
  });

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[pts.length-1][0]} ${H-pad.b} L ${pts[0][0]} ${H-pad.b} Z`;

  return (
    <div style={{ height: `${H + 8}px` }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: `${H}px` }}>
        <defs>
          <linearGradient id="faculty-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25,50,75].map(v => {
          const y = pad.t + (1 - v/maxVal) * (H - pad.t - pad.b);
          return <line key={v} x1={pad.l} y1={y} x2={W-pad.r} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />;
        })}
        {weeks.map((w, i) => {
          const x = pad.l + (i/(weeks.length-1)) * (W - pad.l - pad.r);
          return <text key={w} x={x} y={H-4} textAnchor="middle" fontSize="9" fill="var(--text-faint)">{w}</text>;
        })}
        <path d={area} fill="url(#faculty-trend)" />
        <path d={line} fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#14B8A6" stroke="var(--surface)" strokeWidth="2" />)}
      </svg>
    </div>
  );
}
