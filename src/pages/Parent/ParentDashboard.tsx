import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../Student/components/MetricCard';
import SubjectProgressList from '../Student/components/SubjectProgressList';
import { apiRequest } from '../../lib/api';
import { parentActivity, parentGrowth, parentMastery, parentMetrics, parentReports } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';

export default function ParentDashboard() {
  const [data, setData] = useState<any>({
    metrics: parentMetrics,
    growth: parentGrowth,
    mastery: parentMastery,
    reports: parentReports,
    activity: parentActivity,
    latestPrediction: 94.5,
  });

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/parent/dashboard')
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="Parent Dashboard"
        subtitle="A calm, read-only view of your child’s progress, attendance, and academic growth."
        actions={
          <>
            <Link
              to={pathFor('student')}
              className="px-4 h-10 inline-flex items-center rounded-lg border border-outline text-on-surface hover:bg-surface-container"
            >
              Student View
            </Link>
            <Link
              to={pathFor('faculty')}
              className="px-4 h-10 inline-flex items-center rounded-lg bg-secondary text-on-secondary hover:opacity-90"
            >
              Faculty View
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
          <Card title="Academic Growth Progression" className="xl:col-span-7">
            <div className="flex items-end gap-4 h-72">
              {data.growth.map((point: any) => (
                <div key={point.label} className="flex-1 flex flex-col items-center gap-3 h-full">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-primary to-secondary"
                      style={{ height: `${point.percent}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-label-md font-label-md text-on-surface">{point.label}</div>
                    <div className="text-[11px] text-on-surface-variant">{point.percent}%</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Concept Mastery" className="xl:col-span-5">
            <SubjectProgressList subjects={data.mastery} />
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
          <Card title="Academic Reports" className="xl:col-span-5">
            <div className="space-y-3">
              {data.reports.map((report: any) => (
                <div
                  key={report.title}
                  className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">{report.icon}</span>
                    <div>
                      <div className="font-label-lg text-label-lg text-on-surface">{report.title}</div>
                      <div className="text-body-md text-on-surface-variant">{report.detail}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-lg hover:opacity-90"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card title="AI Prediction" className="xl:col-span-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white p-6">
              <div className="text-label-md uppercase tracking-widest opacity-70">Projected Finals Score</div>
              <div className="mt-3 text-display-lg">{data.latestPrediction}%</div>
              <p className="mt-3 text-body-lg text-white/80">
                If the current study rhythm continues, your child is on track to move into the top 1%
                band before the next mock test cycle.
              </p>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-secondary text-secondary py-3 font-label-lg hover:bg-secondary-fixed"
            >
              Schedule Parent-Teacher AI Meeting
            </button>
          </Card>

          <Card title="Recent Activity" className="xl:col-span-3">
            <div className="space-y-4">
              {data.activity.map((item: any) => (
                <div key={item.title} className="border-b border-outline-variant/50 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'w-2.5 h-2.5 rounded-full',
                        item.tone === 'primary'
                          ? 'bg-primary'
                          : item.tone === 'secondary'
                            ? 'bg-secondary'
                            : 'bg-on-tertiary-container',
                      ].join(' ')}
                    />
                    <div className="font-label-lg text-label-lg text-on-surface">{item.title}</div>
                  </div>
                  <div className="text-body-md text-on-surface-variant mt-1">{item.detail}</div>
                  <div className="text-[11px] uppercase tracking-widest text-on-surface-variant mt-2">{item.time}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
