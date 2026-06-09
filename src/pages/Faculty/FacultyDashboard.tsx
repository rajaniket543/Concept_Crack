import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../Student/components/MetricCard';
import ProgressBar from '../Student/components/ProgressBar';
import { apiRequest } from '../../lib/api';
import { facultyAlerts, facultyMetrics, facultyStudents, facultyTrend } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';

export default function FacultyDashboard() {
  const [data, setData] = useState<any>({
    metrics: facultyMetrics,
    trend: facultyTrend,
    alerts: facultyAlerts,
    students: facultyStudents,
    curriculumGap: {
      headline: '64% of students are struggling with Asymptotic Complexity.',
      focusAreas: ['Algebra', 'Complexity', 'Probability'],
    },
  });

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/faculty/dashboard')
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
        title="Academic Overview"
        subtitle="Advanced CS - 2024 (Section A)"
        actions={
          <>
            <Link
              to={pathFor('questionBank')}
              className="px-4 h-10 inline-flex items-center rounded-lg border border-outline text-on-surface hover:bg-surface-container"
            >
              Question Bank
            </Link>
            <Link
              to={pathFor('admin')}
              className="px-4 h-10 inline-flex items-center rounded-lg bg-secondary text-on-secondary hover:opacity-90"
            >
              Admin View
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
          <Card title="Batch Performance Trend" className="xl:col-span-8">
            <div className="h-72 flex items-end gap-4">
              {data.trend.map((point: any) => (
                <div key={point.label} className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-full rounded-t-xl bg-primary/10 flex items-end h-56">
                    <div
                      className="w-full rounded-t-xl bg-secondary"
                      style={{ height: `${point.percent}%` }}
                    />
                  </div>
                  <div className="text-label-md font-label-md text-on-surface-variant">{point.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Quick Actions" className="xl:col-span-4">
            <div className="space-y-3">
              {[
                { icon: 'add_circle', label: 'Add Question' },
                { icon: 'quiz', label: 'Create Test' },
                { icon: 'notifications_active', label: 'Send Notification' },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="w-full flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 hover:bg-surface-container"
                >
                  <span className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">{action.icon}</span>
                    <span className="font-label-lg text-label-lg text-on-surface">{action.label}</span>
                  </span>
                  <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-secondary-fixed p-4">
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined">warning</span>
                <span className="font-label-lg text-label-lg">Intervention Required</span>
              </div>
              <div className="mt-4 space-y-3">
                {data.alerts.map((alert: any) => (
                  <div key={alert.name} className="rounded-xl bg-white p-3 border border-outline-variant/50">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-label-lg text-label-lg text-on-surface">{alert.name}</div>
                        <div className="text-body-md text-on-surface-variant">{alert.reason}</div>
                      </div>
                      <span className="text-[11px] uppercase tracking-widest text-secondary font-bold">
                        {alert.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card title="Student Analytics" action={<span className="text-label-md text-on-surface-variant">Page 1 of 4</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant text-label-md uppercase tracking-widest text-on-surface-variant">
                  <th className="py-3 pr-4">Rank</th>
                  <th className="py-3 pr-4">Student</th>
                  <th className="py-3 pr-4 text-right">Accuracy</th>
                  <th className="py-3 pr-4 text-right">Attendance</th>
                  <th className="py-3 pr-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((row: any) => (
                  <tr key={row.rank} className="border-b border-outline-variant/40 last:border-b-0">
                    <td className="py-4 pr-4 font-bold text-primary">{row.rank}</td>
                    <td className="py-4 pr-4 font-label-lg text-label-lg text-on-surface">{row.name}</td>
                    <td className="py-4 pr-4 text-right">{row.accuracy}</td>
                    <td className="py-4 pr-4 text-right">{row.attendance}</td>
                    <td className="py-4 pr-4 text-right text-secondary">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Curriculum Gap">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-8">
              <div className="text-body-lg text-on-surface-variant">
                {data.curriculumGap.headline} The AI engine suggests a targeted revision block and two follow-up tests this week.
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ['Algebra', 86],
                  ['Complexity', 64],
                  ['Probability', 91],
                ].map(([label, value]) => (
                  <ProgressBar
                    key={label}
                    label={label as string}
                    trailing={`${value}%`}
                    percent={value as number}
                    barClass={label === 'Complexity' ? 'bg-secondary' : 'bg-primary'}
                  />
                ))}
              </div>
            </div>
            <div className="md:col-span-4">
              <button
                type="button"
                className="w-full rounded-2xl bg-primary text-on-primary py-4 font-label-lg hover:opacity-90"
              >
                Generate Revision Plan
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
