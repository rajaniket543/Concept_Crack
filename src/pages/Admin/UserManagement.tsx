import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { apiRequest } from '../../lib/api';
import { userMetrics, users } from '../../mocks/portal';

const TABS = ['All', 'Students', 'Faculty', 'Administrators'] as const;

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  Student:      { bg: 'rgba(91,79,232,0.10)',  color: '#5B4FE8' },
  Faculty:      { bg: 'rgba(139,92,246,0.10)', color: '#7C3AED' },
  Admin:        { bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
  Parent:       { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
};
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Active:    { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  Inactive:  { bg: 'var(--surface-muted)',  color: 'var(--text-faint)' },
  Suspended: { bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
};

export default function UserManagement() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>({
    metrics: userMetrics,
    users,
    aiUsageInsights: [
      { label: 'Student logins',    percent: 86 },
      { label: 'Faculty activity',  percent: 72 },
      { label: 'Admin operations',  percent: 54 },
      { label: 'Parent check-ins',  percent: 41 },
    ],
    recommendation: 'User activity is concentrated in weekday mornings. Schedule maintenance after 02:00 UTC.',
  });

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/admin/users')
      .then(payload => { if (!cancelled) setData(payload); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => data.users.filter((user: any) => {
    const tabMatch = tab === 'All' ||
      (tab === 'Students' && user.role === 'Student') ||
      (tab === 'Faculty' && user.role === 'Faculty') ||
      (tab === 'Administrators' && user.role === 'Admin');
    const searchMatch = `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(search.toLowerCase());
    return tabMatch && searchMatch;
  }), [data.users, tab, search]);

  const metricMeta = [
    { icon: 'group',           color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)' },
    { icon: 'person_add',      color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { icon: 'person_off',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    { icon: 'co_present',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'User Management' }]}
        showSearch={false}
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              User Management
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              Manage students, faculty, parents, and administrators across all institutions
            </p>
          </div>
          <button type="button" className="btn-primary btn-md flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Add User
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {data.metrics.map((m: any, i: number) => {
            const meta = metricMeta[i] ?? metricMeta[0];
            return (
              <div key={m.label} className="card">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: meta.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: meta.color }}>{meta.icon}</span>
                </div>
                <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{m.value}</div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* Filters + table */}
        <Card noPad>
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            {/* Tab pills */}
            <div className="tab-pills">
              {TABS.map(t => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`tab-pill ${tab === t ? 'active' : ''}`}>{t}</button>
              ))}
            </div>
            {/* Search */}
            <div className="ml-auto search-bar w-full sm:w-72">
              <span className="material-symbols-outlined text-[18px] shrink-0">search</span>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Institute</th>
                  <th>Last Active</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user: any) => {
                  const roleStyle = ROLE_BADGE[user.role] ?? ROLE_BADGE.Student;
                  const statusStyle = STATUS_BADGE[user.status ?? 'Active'] ?? STATUS_BADGE.Active;
                  return (
                    <tr key={user.email ?? user.name}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                            {user.initials ?? user.name?.slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</div>
                            <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge text-label-sm px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>
                          {user.role}
                        </span>
                      </td>
                      <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{user.institute ?? '—'}</span></td>
                      <td><span className="text-body-md" style={{ color: 'var(--text-muted)' }}>{user.lastActive ?? user.lastLogin ?? '—'}</span></td>
                      <td>
                        <span className="badge text-label-sm px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                          {user.status ?? 'Active'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button type="button" className="icon-btn icon-btn-sm" title="Edit user">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                          </button>
                          <button type="button" className="icon-btn icon-btn-sm" title="More options">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>more_vert</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10" style={{ color: 'var(--text-faint)' }}>
                      No users match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{filtered.length} users</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map(p => (
                <button
                  key={p}
                  type="button"
                  className="w-8 h-8 rounded-md text-sm font-semibold transition-colors"
                  style={p === 1
                    ? { backgroundColor: '#5B4FE8', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* AI Usage Insights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card title="AI Usage Insights" subtitle="Role-based engagement metrics">
            <div className="space-y-4">
              {data.aiUsageInsights.map((item: any) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-body-md" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                    <span className="text-label-lg font-semibold" style={{ color: '#5B4FE8' }}>{item.percent}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="AI Recommendation" subtitle="Operational insights from PrepMInd AI">
            <div className="ai-panel">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#5B4FE8' }}>auto_awesome</span>
                <span className="text-label-lg font-semibold" style={{ color: 'var(--text-primary)' }}>System Insight</span>
              </div>
              <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{data.recommendation}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
