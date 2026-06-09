import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../Student/components/MetricCard';
import ProgressBar from '../Student/components/ProgressBar';
import { apiRequest } from '../../lib/api';
import { userMetrics, users } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';

const TABS = ['All', 'Students', 'Faculty', 'Administrators'] as const;

export default function UserManagement() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>({
    metrics: userMetrics,
    users,
    aiUsageInsights: [
      { label: 'Student logins', percent: 86 },
      { label: 'Faculty activity', percent: 72 },
      { label: 'Admin operations', percent: 54 },
      { label: 'Parent check-ins', percent: 41 },
    ],
    recommendation: 'User activity is concentrated in weekday mornings. Schedule maintenance after 02:00 UTC.',
  });

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/admin/users')
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return data.users.filter((user: any) => {
      const matchesTab =
        tab === 'All' ||
        (tab === 'Students' && user.role === 'Student') ||
        (tab === 'Faculty' && user.role === 'Faculty') ||
        (tab === 'Administrators' && user.role === 'Admin');
      const matchesSearch =
        `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [data.users, search, tab]);

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="User Management"
        subtitle="Search, filter, and oversee platform users."
        actions={
          <>
            <Link
              to={pathFor('admin')}
              className="px-4 h-10 inline-flex items-center rounded-lg border border-outline text-on-surface hover:bg-surface-container"
            >
              Admin Dashboard
            </Link>
            <Link
              to={pathFor('institutes')}
              className="px-4 h-10 inline-flex items-center rounded-lg bg-secondary text-on-secondary hover:opacity-90"
            >
              Institutes
            </Link>
          </>
        }
      />

      <div className="p-container-desktop space-y-stack-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
          {data.metrics.map((tile: any) => (
            <MetricCard key={tile.label} tile={tile} />
          ))}
        </div>

        <Card title="Filters">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <label className="md:col-span-5 block">
              <span className="text-label-md text-on-surface-variant">Search users</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, role, or status"
                className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              />
            </label>
            <div className="md:col-span-7 flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={[
                    'rounded-full px-4 py-2 text-label-lg border transition-colors',
                    tab === item
                      ? 'bg-primary text-on-primary border-primary'
                      : 'border-outline-variant text-on-surface hover:bg-surface-container',
                  ].join(' ')}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title="User Directory">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant text-label-md uppercase tracking-widest text-on-surface-variant">
                  <th className="py-3 pr-4">User</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Last Active</th>
                  <th className="py-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: any) => (
                  <tr key={user.email} className="border-b border-outline-variant/40 last:border-b-0">
                    <td className="py-4 pr-4">
                      <div className="font-label-lg text-label-lg text-on-surface">{user.name}</div>
                      <div className="text-body-md text-on-surface-variant">{user.email}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="rounded-full bg-secondary-fixed px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={[
                          'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest',
                          user.status === 'Active'
                            ? 'bg-primary-fixed text-on-primary-fixed'
                            : user.status === 'Pending'
                              ? 'bg-secondary-fixed text-on-secondary-fixed'
                              : 'bg-error-container text-on-error-container',
                        ].join(' ')}
                      >
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {user.status}
                      </span>
                    </td>
                    <td className="py-4 pr-4">{user.lastActive}</td>
                    <td className="py-4 pr-4 text-right">
                      <button type="button" className="text-primary font-label-lg hover:underline">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
          <Card title="AI Usage Insights" className="xl:col-span-7">
            <div className="space-y-4">
              {data.aiUsageInsights.map((item: any) => (
                <ProgressBar
                  key={item.label}
                  label={item.label}
                  trailing={`${item.percent}%`}
                  percent={item.percent}
                  barClass={item.label === 'Faculty activity' ? 'bg-secondary' : 'bg-primary'}
                />
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-secondary-fixed p-4">
              <div className="font-label-lg text-label-lg text-secondary">Recommendation</div>
              <p className="mt-2 text-body-lg text-on-surface">{data.recommendation}</p>
            </div>
          </Card>

          <Card title="Quick Actions" className="xl:col-span-5">
            <div className="space-y-3">
              {['Broadcast Announcement', 'Reset Global Passwords', 'Export Activity Logs'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left hover:bg-surface-container"
                >
                  <div className="font-label-lg text-label-lg text-on-surface">{item}</div>
                  <div className="text-body-md text-on-surface-variant">Available to super-admins and institute owners.</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
