import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import CircularProgress from './components/CircularProgress';
import HeatmapGrid from './components/HeatmapGrid';
import {
  insightsProfile,
  revisionPriorities,
  genInsightsHeatmap,
  type InsightsMetric,
} from '../../mocks/student';
import { pathFor } from '../../lib/pages';
import { apiRequest } from '../../lib/api';

type Scope = 'Institution' | 'Cohort A' | 'Individual';

const TONE_STROKE: Record<InsightsMetric['tone'], string> = {
  primary: '#000666',
  secondary: '#7c4dff',
  tertiary: '#00ab93',
};

const TONE_CENTER: Record<InsightsMetric['tone'], string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-on-tertiary-container',
};

export default function AIAdaptiveInsights() {
  const [scope, setScope] = useState<Scope>('Institution');
  const [cells, setCells] = useState(genInsightsHeatmap(72));
  const [profile, setProfile] = useState(insightsProfile);
  const [priorities, setPriorities] = useState(revisionPriorities);

  useEffect(() => {
    void apiRequest<{
      insightsProfile: typeof insightsProfile;
      revisionPriorities: typeof revisionPriorities;
      knowledgeGapHeatmap: ReturnType<typeof genInsightsHeatmap>;
    }>('/api/student/insights')
      .then((payload) => {
        setProfile(payload.insightsProfile);
        setPriorities(payload.revisionPriorities);
        setCells(payload.knowledgeGapHeatmap);
      })
      .catch(() => {
        setProfile(insightsProfile);
        setPriorities(revisionPriorities);
        setCells(genInsightsHeatmap(72));
      });
  }, []);

  return (
    <div className="p-gutter space-y-stack-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-1">
            Adaptive Learning Insights
          </h1>
          <p className="text-on-surface-variant font-body-lg">
            {scope === 'Institution' && 'Institutional Overview for Advanced Pedagogy'}
            {scope === 'Cohort A' && 'Cohort A Performance Analytics'}
            {scope === 'Individual' && 'Your Personalised Learning Profile'}
          </p>
        </div>
        <div className="flex gap-2 bg-surface-container p-1 rounded-xl">
          {(['Institution', 'Cohort A', 'Individual'] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={[
                'px-4 py-2 rounded-lg font-label-lg text-label-lg transition-colors',
                scope === s
                  ? 'bg-surface-container-lowest shadow-sm text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Learning Profile + Improvement Trend (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-gutter">
          <div className="bg-surface-container-lowest rounded-xl p-card border border-outline-variant shadow-sm flex-1">
            <div className="flex items-center justify-between mb-stack-lg">
              <h4 className="font-title-lg text-title-lg text-on-surface">Learning Profile</h4>
              <span
                className="material-symbols-outlined text-secondary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                stars
              </span>
            </div>
            <div className="space-y-stack-lg">
              {profile.map((m) => (
                <div key={m.label} className="flex items-center gap-4">
                  <CircularProgress
                    percent={m.percent}
                    strokeColor={TONE_STROKE[m.tone]}
                    centerLabel={`${m.percent}%`}
                    centerLabelClass={`font-label-lg ${TONE_CENTER[m.tone]}`}
                  />
                  <div>
                    <p className="font-label-lg text-on-surface">{m.label}</p>
                    <p className="text-on-surface-variant text-[12px]">{m.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Improvement Trend (inline SVG) */}
          <div className="bg-surface-container-lowest rounded-xl p-card border border-outline-variant shadow-sm h-64 flex flex-col">
            <h4 className="font-title-lg text-title-lg text-on-surface mb-2">Improvement Trend</h4>
            <div className="flex-1 relative mt-4">
              <svg className="w-full h-full drop-shadow-lg" viewBox="0 0 400 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#7c4dff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#7c4dff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 130 Q 50 120, 100 100 T 200 60 T 300 40 T 400 10 V 150 H 0 Z"
                  fill="url(#grad1)"
                  opacity="0.1"
                />
                <path
                  d="M0 130 Q 50 120, 100 100 T 200 60 T 300 40 T 400 10"
                  fill="none"
                  stroke="#7c4dff"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
                <circle cx="400" cy="10" fill="#7c4dff" r="4" />
              </svg>
              <div className="flex justify-between mt-2 px-2 text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">
                <span>Week 1</span>
                <span>Week 2</span>
                <span>Week 3</span>
                <span>Week 4</span>
              </div>
            </div>
          </div>
        </section>

        {/* Knowledge Gap Heatmap (8 cols) */}
        <Card
          className="lg:col-span-8"
          title="Knowledge Gap Analysis"
          action={
            <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
              <span>Critical</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-error/20" />
                <div className="w-3 h-3 rounded-sm bg-primary-container/40" />
                <div className="w-3 h-3 rounded-sm bg-primary-container/70" />
                <div className="w-3 h-3 rounded-sm bg-primary-container" />
              </div>
              <span>Mastered</span>
            </div>
          }
        >
          <div className="flex-1">
            <HeatmapGrid
              cells={cells.map((c) => ({
                cellClass: c.cellClass,
                tooltip: `${c.module} · Score: ${c.score}% · Trend: ${
                  c.trend === 'up' ? '↑ Increasing' : c.trend === 'down' ? '↓ Decreasing' : '→ Flat'
                }`,
              }))}
              cols={12}
              cellSize="sm"
            />
          </div>
          <div className="mt-4 grid grid-cols-6 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest text-center">
            <span>Concept A</span>
            <span>Concept B</span>
            <span>Concept C</span>
            <span>Concept D</span>
            <span>Concept E</span>
            <span>Concept F</span>
          </div>
        </Card>

        {/* Revision Priority + AI CTA (12 cols) */}
        <section className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div className="md:col-span-2 bg-surface-container-lowest rounded-xl p-card border border-outline-variant shadow-sm">
            <h4 className="font-title-lg text-title-lg text-on-surface mb-stack-lg">
              Revision Priority
            </h4>
            <div className="space-y-3">
              {priorities.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${r.iconBg}`}
                    >
                      <span className={`material-symbols-outlined ${r.iconColor}`}>{r.icon}</span>
                    </div>
                    <div>
                      <p className="font-label-lg text-on-surface">{r.name}</p>
                      <p className="text-[12px] text-on-surface-variant">{r.note}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${r.statusClass}`}
                    >
                      {r.status}
                    </span>
                    <button
                      type="button"
                      aria-label="Open revision"
                      className="material-symbols-outlined text-outline group-hover:text-primary transition-colors"
                    >
                      chevron_right
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Coach CTA */}
          <div className="bg-primary-container rounded-xl p-card shadow-xl relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary opacity-20 blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <span className="material-symbols-outlined text-secondary-fixed-dim text-[48px] mb-4">
                auto_awesome
              </span>
              <h4 className="font-headline-lg text-headline-lg text-white mb-2 leading-tight">
                Ready for your AI Deep Dive?
              </h4>
              <p className="text-on-primary-container text-body-md opacity-80 mb-6">
                Let PrepMind AI construct a personalized roadmap based on your latest retention
                metrics.
              </p>
            </div>
            <Link
              to={pathFor('practice')}
              className="relative z-10 bg-secondary-container text-on-secondary-container font-label-lg text-label-lg py-4 rounded-xl shadow-lg hover:shadow-secondary/40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Generate My Roadmap
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
