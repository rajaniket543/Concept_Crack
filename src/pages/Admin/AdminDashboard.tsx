import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { PageSkeleton, ErrorState } from '../../components/DataStates';
import { adminMetrics, buildHeatmapCells, healthLogs, topInstitutions } from '../../mocks/portal';
import { apiRequest } from '../../lib/api';
import { pathFor } from '../../lib/pages';

export default function AdminDashboard() {
  const [data, setData] = useState<any>({
    metrics: adminMetrics,
    heatmap: buildHeatmapCells(12, 12, 'Peak'),
    topInstitutions,
    healthLogs,
    securityNotes: ['SOC2 Compliant', '99.9% Uptime', 'Encrypted Multi-Tenancy'],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/admin/dashboard')
      .then(payload => { if (!cancelled) setData(payload); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const metricMeta = [
    { icon: 'group',          color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
    { icon: 'apartment',      color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { icon: 'quiz',           color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { icon: 'trending_up',    color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
  ];

  const HEATMAP_LEVELS = [
    'rgba(236,72,153,0.06)', 'rgba(236,72,153,0.18)', 'rgba(236,72,153,0.38)', 'rgba(236,72,153,0.60)', 'rgba(236,72,153,0.90)',
  ];

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Dashboard' }]} />
        <div className="flex-1 p-6 lg:p-8 overflow-auto"><PageSkeleton /></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Dashboard' }]} />
        <div className="flex-1 p-6 lg:p-8 overflow-auto"><ErrorState message="We couldn't load the dashboard." /></div>
      </div>
    );
  }

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
              to={pathFor('institutes')}
              className="btn-primary btn-md flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>apartment</span>
              Institutes
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
            Cross-institute intelligence, health monitoring, and platform operations
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {data.metrics.map((m: any, i: number) => {
            const meta = metricMeta[i] ?? metricMeta[0];
            const isPositive = (m.trend ?? 0) >= 0;
            return (
              <div key={m.label} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: meta.color }}>{meta.icon}</span>
                  </div>
                  {m.trend !== undefined && (
                    <span
                      className="text-label-sm font-bold px-2 py-0.5 rounded-full"
                      style={isPositive ? { backgroundColor: 'rgba(16,185,129,0.10)', color: '#10B981' } : { backgroundColor: 'rgba(239,68,68,0.10)', color: '#EF4444' }}
                    >
                      {isPositive ? '+' : ''}{m.trend}%
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{m.value}</div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* Activity heatmap + AI health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card
            title="Platform Activity Heatmap"
            subtitle="User activity distribution across hours and days"
            action={
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>Low</span>
                {[0.06, 0.25, 0.55, 0.90].map((o, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(236,72,153,${o})` }} />
                ))}
                <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>High</span>
              </div>
            }
            className="lg:col-span-2"
          >
            <div className="grid gap-1 mt-2" style={{ gridTemplateColumns: `repeat(12, minmax(0, 1fr))` }}>
              {(data.heatmap ?? []).map((cell: any, i: number) => {
                const intensity = cell.intensity ?? cell.level ?? Math.floor(Math.random() * 5);
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-sm transition-all hover:scale-110 cursor-default"
                    style={{ backgroundColor: HEATMAP_LEVELS[Math.min(intensity, 4)] }}
                    title={cell.tooltip ?? `${cell.label ?? `Hour ${i}`}: ${cell.value ?? intensity * 20}% activity`}
                  />
                );
              })}
            </div>
          </Card>

          {/* AI Health */}
          <Card title="AI System Health" subtitle="Service status and performance">
            <div className="space-y-3">
              {(data.healthLogs ?? []).slice(0, 5).map((log: any, i: number) => {
                const statusMap: Record<string, { color: string; bg: string; icon: string }> = {
                  healthy:  { color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: 'check_circle' },
                  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', icon: 'warning' },
                  error:    { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', icon: 'error' },
                };
                const status = statusMap[log.status ?? 'healthy'];
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: status.bg }}>
                    <span className="material-symbols-outlined filled" style={{ fontSize: '18px', color: status.color }}>{status.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-md font-medium truncate" style={{ color: 'var(--text-primary)' }}>{log.service ?? log.name}</div>
                      <div className="text-label-sm truncate" style={{ color: 'var(--text-muted)' }}>{log.message ?? log.detail ?? 'All systems operational'}</div>
                    </div>
                    <span className="text-label-sm font-bold shrink-0" style={{ color: status.color }}>
                      {log.latency ? `${log.latency}ms` : 'OK'}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Security notes */}
            <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
              {data.securityNotes.map((note: string) => (
                <div key={note} className="flex items-center gap-2 text-body-sm" style={{ color: '#10B981' }}>
                  <span className="material-symbols-outlined filled" style={{ fontSize: '16px' }}>shield</span>
                  {note}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Top institutions */}
        <Card
          title="Top Institutions"
          subtitle="Ranked by student performance and engagement"
          action={
            <Link to={pathFor('institutes')} className="btn-outline btn-md flex items-center gap-1.5">
              View all
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </Link>
          }
          noPad
        >
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Institution</th>
                  <th>Region</th>
                  <th>Students</th>
                  <th>Avg Score</th>
                  <th>Plan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.topInstitutions?.slice(0, 8).map((inst: any, i: number) => (
                  <tr key={inst.name ?? i}>
                    <td>
                      <span className="text-body-md font-bold" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: `hsl(${(i * 47) % 360}, 65%, 55%)` }}
                        >
                          {inst.name?.slice(0, 2) ?? 'IN'}
                        </div>
                        <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{inst.name}</div>
                      </div>
                    </td>
                    <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{inst.region}</span></td>
                    <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{inst.studentCount ?? inst.students ?? '—'}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar w-14">
                          <div className="progress-bar-fill" style={{ width: `${inst.avgScore ?? 70}%`, backgroundColor: '#EC4899' }} />
                        </div>
                        <span className="text-label-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{inst.avgScore ?? 70}%</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={inst.plan === 'Enterprise' ? { backgroundColor: 'rgba(236,72,153,0.10)', color: '#EC4899' }
                          : inst.plan === 'Growth' ? { backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }
                          : { backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }
                        }
                      >
                        {inst.plan ?? 'Starter'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${inst.status === 'Active' ? 'badge-success' : 'badge-muted'}`}>
                        {inst.status ?? 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

const HEATMAP_LEVELS = [
  'rgba(236,72,153,0.06)', 'rgba(236,72,153,0.18)', 'rgba(236,72,153,0.38)', 'rgba(236,72,153,0.60)', 'rgba(236,72,153,0.90)',
];
