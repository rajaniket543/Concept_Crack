import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import MetricCard from './components/MetricCard';
import WeeklyBarChart from './components/WeeklyBarChart';
import SubjectProgressList from './components/SubjectProgressList';
import HeatmapGrid from './components/HeatmapGrid';
import AIInsightBanner from './components/AIInsightBanner';
import { apiRequest } from '../../lib/api';
import {
  currentStudent,
  dashboardMetrics,
  subjectPerformance,
  weeklyProgress,
  heatmapCells,
  weakAreas,
  aiRecommendations,
} from '../../mocks/student';

export default function StudentDashboard() {
  const [range, setRange] = useState('Last 7 Days');
  const [data, setData] = useState<any>({
    currentStudent,
    metrics: dashboardMetrics,
    weeklyProgress,
    subjectPerformance,
    heatmapCells,
    weakAreas,
    aiRecommendations,
  });

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/student/dashboard')
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-container-desktop space-y-stack-lg">
      {/* Header strip mirrors the mock's "Greeting + sub-line" pattern. */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Welcome back, {data.currentStudent.name.split(' ')[0]}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Here is a snapshot of your academic progress this week.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/student/insights"
            className="bg-secondary text-on-secondary px-5 py-2 rounded-lg font-label-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
            AI Assistant
          </Link>
        </div>
      </div>

      {/* Bento grid metrics row. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {data.metrics.map((m: any) => (
          <MetricCard key={m.label} tile={m} />
        ))}
      </div>

      {/* Charts + subject performance row. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <Card
          title="Weekly Progress Trend"
          action={
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-transparent border-none text-label-md font-label-lg text-on-surface-variant focus:ring-0 cursor-pointer"
            >
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          }
          className="lg:col-span-2"
        >
          <WeeklyBarChart data={data.weeklyProgress} />
        </Card>
        <Card title="Subject Performance">
          <SubjectProgressList subjects={data.subjectPerformance} />
        </Card>
      </div>

      {/* Heatmap + weak areas + AI recs. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <Card
          title="Topic Mastery Heatmap"
          action={
            <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
              <span>Low</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-primary/10 rounded-sm" />
                <div className="w-3 h-3 bg-primary/30 rounded-sm" />
                <div className="w-3 h-3 bg-primary/60 rounded-sm" />
                <div className="w-3 h-3 bg-primary rounded-sm" />
              </div>
              <span>High</span>
            </div>
          }
          className="lg:col-span-2"
        >
          <p className="text-body-md text-on-surface-variant mb-4">
            Daily proficiency growth across all core topics
          </p>
          <HeatmapGrid
            cells={data.heatmapCells.map((c: any) => ({
              cellClass: c.cellClass,
              tooltip: `${c.topic}: ${c.percent}%`,
            }))}
            cols={12}
          />
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error">warning</span>
              Weak Areas
            </span>
          }
        >
          <div className="space-y-3">
            {data.weakAreas.map((w: any) => (
              <div
                key={w.name}
                className="p-3 bg-error-container/20 rounded-lg border border-error/10 flex justify-between items-center"
              >
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface">{w.name}</p>
                  <p className="text-xs text-on-surface-variant">{w.note}</p>
                </div>
                <span className="text-error font-bold text-label-md">{w.percent}%</span>
              </div>
            ))}
          </div>
        </Card>

        <AIInsightBanner
          tone="primary-container"
          title="AI Recommended Practice"
          className="lg:col-span-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md mt-4">
            {data.aiRecommendations.map((r: any) => (
              <Link
                key={r.title}
                to="/student/practice"
                className="bg-on-primary-fixed text-primary p-4 rounded-lg flex flex-col justify-between hover:bg-primary-fixed transition-colors group text-left"
              >
                <div>
                  <h4 className="font-label-lg text-label-lg">{r.title}</h4>
                  <p className="text-sm opacity-80 mt-1">{r.rationale}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {r.durationMins} Mins
                  </span>
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </AIInsightBanner>
      </div>
    </div>
  );
}
