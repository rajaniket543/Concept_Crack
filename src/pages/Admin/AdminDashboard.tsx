import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { pathFor } from '../../lib/pages';
import { hasAI, pingAI, getAIUsage, type AIStatus, type AIUsageSummary } from '../../lib/ai';

// Real platform data pulled straight from Firestore — no mock numbers.

interface AttemptRow {
  id: string;
  studentId: string;
  studentName: string;
  testTitle: string;
  score: number;
  accuracyPct: number;
  submittedAt: string | null;
  tabSwitchCount: number;
}

function toIso(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return null;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Array<{ role: string; status: string; name: string; id: string }>>([]);
  const [testCounts, setTestCounts] = useState({ total: 0, active: 0, pending: 0 });
  const [questionCount, setQuestionCount] = useState(0);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);

  // AI system status panel
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiUsage, setAiUsage] = useState<AIUsageSummary | null>(null);
  const [pinging, setPinging] = useState(false);
  const [dbLatency, setDbLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const dbStart = Date.now();
        const [userSnap, testSnap, questionSnap, attemptSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'tests')),
          getDocs(collection(db, 'questions')),
          getDocs(collection(db, 'testAttempts')),
        ]);
        if (cancelled) return;
        setDbLatency(Date.now() - dbStart);

        const userRows = userSnap.docs.map(d => {
          const u = d.data();
          return { id: d.id, role: (u.role as string) ?? '', status: (u.status as string) ?? 'Active', name: (u.name as string) ?? (u.email as string) ?? '—' };
        });
        setUsers(userRows);
        const nameById = new Map(userRows.map(u => [u.id, u.name]));

        let active = 0, pending = 0;
        const titleByTestId = new Map<string, string>();
        testSnap.docs.forEach(d => {
          const s = d.data().status as string;
          titleByTestId.set(d.id, (d.data().title as string) ?? 'Test');
          if (s === 'active' || s === 'approved') active += 1;
          if (s === 'pending_approval') pending += 1;
        });
        setTestCounts({ total: testSnap.size, active, pending });
        setQuestionCount(questionSnap.size);

        const rows: AttemptRow[] = attemptSnap.docs.map(d => {
          const a = d.data();
          return {
            id: d.id,
            studentId: (a.studentId as string) ?? '',
            studentName: nameById.get((a.studentId as string) ?? '') ?? 'Student',
            testTitle: titleByTestId.get((a.testId as string) ?? '') ?? 'Test',
            score: (a.score as number) ?? 0,
            accuracyPct: (a.accuracyPct as number) ?? 0,
            submittedAt: toIso(a.submittedAt),
            tabSwitchCount: (a.tabSwitchCount as number) ?? 0,
          };
        }).sort((x, y) => (y.submittedAt ?? '').localeCompare(x.submittedAt ?? ''));
        setAttempts(rows);
      } catch (e) {
        console.error('admin dashboard load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    void getAIUsage().then(u => { if (!cancelled) setAiUsage(u); });
    // Auto health-check once on load (only when a key is configured).
    if (hasAI()) {
      void pingAI().then(s => { if (!cancelled) setAiStatus(s); });
    } else {
      setAiStatus({ configured: false, reachable: false, latencyMs: null, model: 'gemini-flash-lite-latest', checkedAt: new Date().toISOString() });
    }

    return () => { cancelled = true; };
  }, []);

  async function runPing() {
    setPinging(true);
    const [s, u] = await Promise.all([pingAI(), getAIUsage()]);
    setAiStatus(s);
    setAiUsage(u);
    setPinging(false);
  }

  const counts = useMemo(() => ({
    students: users.filter(u => u.role === 'student').length,
    faculty: users.filter(u => u.role === 'faculty').length,
    parents: users.filter(u => u.role === 'parent').length,
    activeUsers: users.filter(u => u.status === 'Active').length,
  }), [users]);

  // Daily submission counts for the contribution calendar.
  const submissionsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    attempts.forEach(a => {
      if (!a.submittedAt) return;
      const d = new Date(a.submittedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [attempts]);

  const metrics = [
    { label: 'Total Users', value: users.length, sub: `${counts.activeUsers} active`, icon: 'group', color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
    { label: 'Students / Faculty', value: `${counts.students} / ${counts.faculty}`, sub: `${counts.parents} parents linked`, icon: 'school', color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)' },
    { label: 'Tests on Platform', value: testCounts.total, sub: `${testCounts.active} live · ${testCounts.pending} pending approval`, icon: 'quiz', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Question Bank', value: questionCount, sub: `${attempts.length} attempts recorded`, icon: 'library_books', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  ];

  const fmtWhen = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Admin Dashboard' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to={pathFor('users')} className="btn-outline btn-md flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>group</span>
              Users
            </Link>
            <Link
              to={pathFor('testApprovals')}
              className="btn-primary btn-md flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span>
              Approvals{testCounts.pending > 0 ? ` (${testCounts.pending})` : ''}
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Platform Overview
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Live platform data — users, tests, activity and system health
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map(m => (
            <div key={m.label} className="card">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: m.bg }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: m.color }}>{m.icon}</span>
              </div>
              <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                {loading ? '…' : m.value}
              </div>
              <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
              <div className="text-label-sm mt-1" style={{ color: 'var(--text-faint)' }}>{loading ? '' : m.sub}</div>
            </div>
          ))}
        </div>

        {/* Activity heatmap + AI system status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card
            title="Platform Activity"
            subtitle="Test submissions per day over the last 6 months"
            className="lg:col-span-2"
          >
            {loading ? (
              <div className="flex items-center justify-center py-10"><Spinner size={22} color="#EC4899" /></div>
            ) : (
              <ActivityHeatmap data={submissionsByDay} colorBase="#10B981" unit="submission" />
            )}
          </Card>

          {/* AI System Status */}
          <Card
            title="AI System Status"
            subtitle="Service, health, usage & availability"
            action={
              <button type="button" onClick={() => void runPing()} disabled={pinging} className="btn-outline btn-sm flex items-center gap-1.5">
                {pinging ? <Spinner size={13} /> : <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>refresh</span>}
                Check now
              </button>
            }
          >
            <div className="space-y-2.5">
              {[
                {
                  label: 'AI Service',
                  value: aiStatus?.configured ? 'Configured' : 'Not configured',
                  detail: aiStatus?.model ?? 'gemini-flash-lite-latest',
                  ok: aiStatus?.configured ?? false,
                },
                {
                  label: 'AI Health',
                  value: aiStatus?.reachable === null ? 'Checking…' : aiStatus?.reachable ? 'Operational' : 'Unreachable',
                  detail: aiStatus?.latencyMs != null ? `${aiStatus.latencyMs} ms round-trip` : aiStatus?.configured ? '' : 'Add VITE_GEMINI_API_KEY to enable',
                  ok: aiStatus?.reachable ?? false,
                },
                {
                  label: 'AI Usage',
                  value: aiUsage ? `${aiUsage.todayCalls} calls today` : '—',
                  detail: aiUsage ? `${aiUsage.totalCalls} all-time · ${aiUsage.totalErrors} errors` : '',
                  ok: true,
                },
                {
                  label: 'AI Availability',
                  value: aiUsage && aiUsage.totalCalls > 0
                    ? `${Math.round(((aiUsage.totalCalls - aiUsage.totalErrors) / aiUsage.totalCalls) * 100)}%`
                    : 'No calls yet',
                  detail: aiUsage?.lastCallAt ? `Last call ${fmtWhen(aiUsage.lastCallAt)}` : '',
                  ok: !aiUsage || aiUsage.totalCalls === 0 || (aiUsage.totalCalls - aiUsage.totalErrors) / aiUsage.totalCalls > 0.9,
                },
                {
                  label: 'Database',
                  value: dbLatency != null ? 'Connected' : 'Checking…',
                  detail: dbLatency != null ? `${dbLatency} ms initial load` : '',
                  ok: dbLatency != null,
                },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: row.ok ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)' }}>
                  <span className="material-symbols-outlined filled shrink-0" style={{ fontSize: '18px', color: row.ok ? '#10B981' : '#EF4444' }}>
                    {row.ok ? 'check_circle' : 'error'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</div>
                    {row.detail && <div className="text-label-sm truncate" style={{ color: 'var(--text-muted)' }}>{row.detail}</div>}
                  </div>
                  <span className="text-label-sm font-bold shrink-0 text-right" style={{ color: row.ok ? '#059669' : '#DC2626' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent test submissions */}
        <Card
          title="Recent Test Submissions"
          subtitle="Latest attempts across the platform, with integrity flags"
          noPad
        >
          {loading ? (
            <div className="flex items-center justify-center py-10"><Spinner size={22} color="#EC4899" /></div>
          ) : attempts.length === 0 ? (
            <div className="py-10 text-center" style={{ color: 'var(--text-faint)' }}>
              No test attempts yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Test</th>
                    <th>Score</th>
                    <th>Accuracy</th>
                    <th>Integrity</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.slice(0, 8).map((a, i) => (
                    <tr key={a.id}>
                      <td><span className="text-body-md font-bold" style={{ color: 'var(--text-muted)' }}>{i + 1}</span></td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}>
                            {a.studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{a.studentName}</span>
                        </div>
                      </td>
                      <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{a.testTitle}</span></td>
                      <td><span className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{a.score}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress-bar w-14">
                            <div className="progress-bar-fill" style={{ width: `${a.accuracyPct}%`, backgroundColor: '#EC4899' }} />
                          </div>
                          <span className="text-label-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{a.accuracyPct}%</span>
                        </div>
                      </td>
                      <td>
                        {a.tabSwitchCount > 0 ? (
                          <span className="badge" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>
                            {a.tabSwitchCount} tab switch{a.tabSwitchCount > 1 ? 'es' : ''}
                          </span>
                        ) : (
                          <span className="badge badge-success">Clean</span>
                        )}
                      </td>
                      <td><span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{fmtWhen(a.submittedAt)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
