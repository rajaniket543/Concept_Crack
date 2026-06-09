import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../Student/components/MetricCard';
import HeatmapGrid from '../Student/components/HeatmapGrid';
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

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/admin/dashboard')
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const heatmap = data.heatmap;

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="Global System Overview"
        subtitle="Cross-institute intelligence, health monitoring, and platform operations."
        actions={
          <>
            <Link
              to={pathFor('users')}
              className="px-4 h-10 inline-flex items-center rounded-lg border border-outline text-on-surface hover:bg-surface-container"
            >
              User Management
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

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
          <Card title="Platform Activity Heatmap" className="xl:col-span-8">
            <div className="mb-4 flex items-center justify-between text-body-md text-on-surface-variant">
              <span>Peak usage window: 14:20</span>
              <span>Active sessions: 4,129</span>
            </div>
            <HeatmapGrid cells={heatmap.map((cell: any, index: number) => ({
              cellClass: index % 5 === 0 ? 'bg-secondary/20' : cell.cellClass,
              tooltip: `${cell.topic} · ${cell.percent}%`,
            }))} cols={12} />
          </Card>

          <Card title="AI Health Index" className="xl:col-span-4">
            <div className="space-y-4">
              {[
                ['Inference Latency', '42ms', 'bg-primary'],
                ['Accuracy Rate', '99.4%', 'bg-secondary'],
                ['Tokens / Minute', '2.4M', 'bg-on-tertiary-container'],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="text-label-md uppercase tracking-widest text-on-surface-variant">{label}</div>
                  <div className={`mt-2 text-title-lg ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
          <Card title="Top Performing Institutions" className="xl:col-span-7">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant text-label-md uppercase tracking-widest text-on-surface-variant">
                    <th className="py-3 pr-4">Institution</th>
                    <th className="py-3 pr-4">Region</th>
                    <th className="py-3 pr-4 text-right">Score</th>
                    <th className="py-3 pr-4 text-right">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topInstitutions.map((row: any) => (
                    <tr key={row.name} className="border-b border-outline-variant/40 last:border-b-0">
                      <td className="py-4 pr-4 font-label-lg text-label-lg text-on-surface">{row.name}</td>
                      <td className="py-4 pr-4">{row.region}</td>
                      <td className="py-4 pr-4 text-right text-primary font-bold">{row.score}</td>
                      <td className="py-4 pr-4 text-right">{row.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="System Health Log" className="xl:col-span-5">
            <div className="space-y-4">
              {data.healthLogs.map((item: any) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-secondary mt-1" />
                    <div className="w-px flex-1 bg-outline-variant/50 mt-1" />
                  </div>
                  <div className="pb-4">
                    <div className="font-label-lg text-label-lg text-on-surface">{item.title}</div>
                    <div className="text-body-md text-on-surface-variant">{item.detail}</div>
                    <div className="text-[11px] uppercase tracking-widest text-on-surface-variant mt-1">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Secure AI Infrastructure">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.securityNotes.map((item: any) => (
              <div key={item} className="rounded-2xl bg-primary text-white p-5">
                <span className="material-symbols-outlined">shield_lock</span>
                <div className="mt-3 font-label-lg text-label-lg">{item}</div>
                <p className="mt-2 text-body-md text-white/75">
                  Platform-level controls are enforced at the API, database, and dashboard layer.
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
