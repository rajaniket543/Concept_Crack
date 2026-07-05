import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { apiRequest } from '../../lib/api';
import { buildHeatmapCells, instituteMetrics, institutes } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';

const REGIONS = ['All', 'Asia-Pacific', 'North India', 'West India', 'South India'];
const PLANS   = ['All', 'Starter', 'Growth', 'Enterprise'];

const PLAN_BADGE: Record<string, { bg: string; color: string }> = {
  Enterprise: { bg: 'rgba(236,72,153,0.10)', color: '#EC4899' },
  Growth:     { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  Starter:    { bg: 'var(--surface-muted)',   color: 'var(--text-muted)' },
};

const HEATMAP_LEVELS = [
  'rgba(236,72,153,0.06)', 'rgba(236,72,153,0.18)', 'rgba(236,72,153,0.38)',
  'rgba(236,72,153,0.60)', 'rgba(236,72,153,0.90)',
];

export default function InstituteManagement() {
  const [region, setRegion] = useState('All');
  const [plan,   setPlan]   = useState('All');
  const [data, setData] = useState<any>({
    metrics: instituteMetrics,
    institutes,
    regionalPerformanceHeatmap: buildHeatmapCells(5, 7, 'Region'),
    optimizationTip:
      'Asia-Pacific institutes are showing a 15% uplift in STEM enrollments after shifting their morning mock slots.',
  });

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/admin/institutes')
      .then(payload => { if (!cancelled) setData(payload); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const filteredInstitutes = useMemo(() => data.institutes.filter((item: any) => {
    const matchesRegion = region === 'All' || item.region === region;
    const matchesPlan   = plan   === 'All' || item.plan   === plan;
    return matchesRegion && matchesPlan;
  }), [data.institutes, plan, region]);

  const metricMeta = [
    { icon: 'apartment',    color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
    { icon: 'group',        color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { icon: 'trending_up',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { icon: 'workspace_premium', color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Institute Management' }]}
        showSearch={false}
        actions={
          <div className="flex items-center gap-2">
            <Link to={pathFor('admin')} className="btn-outline btn-md flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
              Dashboard
            </Link>
            <button type="button" className="btn-primary btn-md flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_business</span>
              Add Institute
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Institute Management
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Region-level visibility, subscription plans, and performance monitoring
          </p>
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

        {/* Filters */}
        <Card title="Directory Filters" subtitle="Narrow by region or subscription plan">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Region</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Plan</label>
              <select
                value={plan}
                onChange={e => setPlan(e.target.value)}
                className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {PLANS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => { setRegion('All'); setPlan('All'); }}
                className="btn-outline btn-md w-full"
              >
                Reset
              </button>
            </div>
          </div>
        </Card>

        {/* Table + Heatmap */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Institutes table */}
          <Card title="Coaching Centers Directory" subtitle={`${filteredInstitutes.length} institutes`} noPad className="xl:col-span-7">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Institute</th>
                    <th>Region</th>
                    <th>Plan</th>
                    <th className="text-right">Students</th>
                    <th className="text-right">Performance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstitutes.map((item: any, i: number) => {
                    const planStyle = PLAN_BADGE[item.plan] ?? PLAN_BADGE.Starter;
                    return (
                      <tr key={item.name ?? i}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: `hsl(${(i * 53) % 360}, 65%, 55%)` }}
                            >
                              {item.name?.slice(0, 2) ?? 'IN'}
                            </div>
                            <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                          </div>
                        </td>
                        <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{item.region}</span></td>
                        <td>
                          <span className="badge text-label-sm px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: planStyle.bg, color: planStyle.color }}>
                            {item.plan}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{item.students ?? item.studentCount ?? '—'}</span>
                        </td>
                        <td className="text-right">
                          <span className="text-label-lg font-bold" style={{ color: '#EC4899' }}>{item.performance ?? item.avgScore ?? '—'}</span>
                        </td>
                        <td>
                          <button type="button" className="icon-btn icon-btn-sm" title="Edit institute">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInstitutes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10" style={{ color: 'var(--text-faint)' }}>
                        No institutes match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Regional heatmap */}
          <Card
            title="Regional Performance Heatmap"
            subtitle="Activity intensity by region and time"
            className="xl:col-span-5"
            action={
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>Low</span>
                {[0.06, 0.25, 0.55, 0.90].map((o, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(236,72,153,${o})` }} />
                ))}
                <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>High</span>
              </div>
            }
          >
            <div className="grid gap-1.5 mt-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {(data.regionalPerformanceHeatmap ?? []).map((cell: any, i: number) => {
                const intensity = cell.intensity ?? cell.level ?? (i % 5);
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-sm transition-all hover:scale-110 cursor-default"
                    style={{ backgroundColor: HEATMAP_LEVELS[Math.min(intensity, 4)] }}
                    title={cell.tooltip ?? `${cell.label ?? cell.topic ?? `Cell ${i}`}: ${cell.percent ?? intensity * 20}%`}
                  />
                );
              })}
            </div>
          </Card>
        </div>

        {/* AI Optimization tip */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-5"
          style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(219,39,119,0.06))', border: '1px solid rgba(236,72,153,0.15)' }}
        >
          <div className="flex items-start gap-4 flex-1">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(236,72,153,0.12)' }}>
              <span className="material-symbols-outlined filled" style={{ fontSize: '22px', color: '#EC4899' }}>auto_awesome</span>
            </div>
            <div>
              <div className="text-body-md font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>AI Optimization Tip</div>
              <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{data.optimizationTip}</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary btn-md shrink-0"
            style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}
          >
            Implement Strategy
          </button>
        </div>
      </div>
    </div>
  );
}
