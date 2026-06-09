import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../Student/components/MetricCard';
import HeatmapGrid from '../Student/components/HeatmapGrid';
import { buildHeatmapCells, instituteMetrics, institutes } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';

export default function InstituteManagement() {
  const [region, setRegion] = useState('All');
  const [plan, setPlan] = useState('All');
  const heatmap = buildHeatmapCells(5, 7, 'Region');

  const filteredInstitutes = useMemo(() => {
    return institutes.filter((item) => {
      const matchesRegion = region === 'All' || item.region === region;
      const matchesPlan = plan === 'All' || item.plan === plan;
      return matchesRegion && matchesPlan;
    });
  }, [plan, region]);

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="Institute Management"
        subtitle="Region-level visibility, plans, and performance monitoring."
        actions={
          <>
            <Link
              to={pathFor('admin')}
              className="px-4 h-10 inline-flex items-center rounded-lg border border-outline text-on-surface hover:bg-surface-container"
            >
              Admin Dashboard
            </Link>
            <Link
              to={pathFor('users')}
              className="px-4 h-10 inline-flex items-center rounded-lg bg-secondary text-on-secondary hover:opacity-90"
            >
              Users
            </Link>
          </>
        }
      />

      <div className="p-container-desktop space-y-stack-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
          {instituteMetrics.map((tile) => (
            <MetricCard key={tile.label} tile={tile} />
          ))}
        </div>

        <Card title="Directory Filters">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-label-md text-on-surface-variant">Region</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              >
                <option>All</option>
                <option>Asia-Pacific</option>
                <option>North India</option>
                <option>West India</option>
                <option>South India</option>
              </select>
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant">Plan</span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              >
                <option>All</option>
                <option>Starter</option>
                <option>Growth</option>
                <option>Enterprise</option>
              </select>
            </label>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
          <Card title="Coaching Centers Directory" className="xl:col-span-7">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant text-label-md uppercase tracking-widest text-on-surface-variant">
                    <th className="py-3 pr-4">Institute</th>
                    <th className="py-3 pr-4">Region</th>
                    <th className="py-3 pr-4">Plan</th>
                    <th className="py-3 pr-4 text-right">Students</th>
                    <th className="py-3 pr-4 text-right">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstitutes.map((item) => (
                    <tr key={item.name} className="border-b border-outline-variant/40 last:border-b-0">
                      <td className="py-4 pr-4 font-label-lg text-label-lg text-on-surface">{item.name}</td>
                      <td className="py-4 pr-4">{item.region}</td>
                      <td className="py-4 pr-4">{item.plan}</td>
                      <td className="py-4 pr-4 text-right">{item.students}</td>
                      <td className="py-4 pr-4 text-right text-primary font-bold">{item.performance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Regional Performance Heatmap" className="xl:col-span-5">
            <HeatmapGrid
              cells={heatmap.map((cell) => ({
                cellClass: cell.cellClass.replace('bg-primary', 'bg-secondary'),
                tooltip: `${cell.topic} · ${cell.percent}%`,
              }))}
              cols={7}
            />
          </Card>
        </div>

        <Card title="AI Optimization Tip">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-8">
              <div className="text-body-lg text-on-surface-variant">
                Asia-Pacific institutes are showing a 15% uplift in STEM enrollments after shifting their morning mock
                slots. The AI engine recommends replicating that schedule in the remaining growth-tier centers.
              </div>
            </div>
            <div className="md:col-span-4">
              <button
                type="button"
                className="w-full rounded-2xl bg-primary text-on-primary py-4 font-label-lg hover:opacity-90"
              >
                Implement Strategy
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
