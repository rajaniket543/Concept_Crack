import { Doughnut, Bar } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import Card from '../../components/Card';
import MetricCard from './components/MetricCard';
import ProgressBar from './components/ProgressBar';
import DonutChart from './components/DonutChart';
import AIInsightBanner from './components/AIInsightBanner';
import { analysis } from '../../mocks/student';
import type { MetricTile } from '../../mocks/student';
import { pathFor } from '../../lib/pages';

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const analysisMetrics: MetricTile[] = [
  {
    label: 'Global Rank',
    value: `#${analysis.rank}`,
    delta: `Top ${analysis.rankPercentile}% of ${(analysis.totalStudents / 1000).toFixed(1)}k Students`,
    icon: 'workspace_premium',
    tone: 'secondary',
  },
  {
    label: 'Accuracy',
    value: `${analysis.accuracyPct}%`,
    delta: `${analysis.correctCount}/50 Questions Correct`,
    icon: 'my_location',
    tone: 'primary',
  },
  {
    label: 'Time Taken',
    value: `${analysis.timeMinutes}m`,
    delta: `${analysis.timeVsAvgMinutes}m ahead of average`,
    icon: 'timer',
    tone: 'muted',
  },
];

export default function TestAnalysis() {
  const donutData = {
    labels: ['Correct', 'Incorrect', 'Skipped'],
    datasets: [
      {
        data: [analysis.correctCount, analysis.incorrectCount, analysis.skippedCount],
        backgroundColor: ['#000666', '#ba1a1a', '#e1e3e4'],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    cutout: '70%',
    plugins: { legend: { display: false } },
  };

  const barData = {
    labels: analysis.topicPerformance.map((t) => t.topic),
    datasets: [
      {
        label: 'Your Accuracy %',
        data: analysis.topicPerformance.map((t) => t.yours),
        backgroundColor: '#7c4dff',
        borderRadius: 8,
        barThickness: 32,
      },
      {
        label: 'Group Avg %',
        data: analysis.topicPerformance.map((t) => t.groupAvg),
        backgroundColor: '#e1e3e4',
        borderRadius: 8,
        barThickness: 32,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, max: 100, grid: { display: false } },
      x: { grid: { display: false } },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, padding: 20, font: { family: 'Inter', size: 12 } },
      },
    },
  };

  return (
    <div className="p-container-desktop space-y-stack-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-2">
            <span>My Exams</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-secondary font-semibold">Mock Test #42 Analysis</span>
          </nav>
          <h1 className="font-headline-lg text-headline-lg text-primary">Performance Deep-Dive</h1>
          <p className="text-on-surface-variant font-body-md text-body-md">
            Advanced Mathematics &amp; Analytical Reasoning — Completed on Oct 24, 2023
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 border border-outline px-4 py-2 rounded-lg font-label-lg text-label-lg text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined">download</span>
            Report
          </button>
          <Link
            to={pathFor('exam')}
            className="flex items-center gap-2 bg-secondary text-on-secondary px-6 py-2 rounded-lg font-label-lg text-label-lg shadow-md hover:opacity-90 transition-opacity"
          >
            Retake Test
          </Link>
        </div>
      </header>

      {/* Row 1: Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <div className="md:col-span-3 bg-surface-container-lowest p-card rounded-xl border border-outline-variant shadow-sm flex flex-col items-center justify-center text-center">
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-2">
            Total Score
          </span>
          <DonutChart
            percent={analysis.totalPct}
            size={128}
            strokeWidth={8}
            strokeColor="text-primary"
            centerLabel="75%"
            centerLabelClass="font-headline-lg text-headline-lg text-primary"
          />
          <p className="font-label-lg text-label-lg text-on-surface mt-2">
            {analysis.totalScore} / {analysis.totalPossible} Points
          </p>
        </div>
        {analysisMetrics.map((m) => (
          <div key={m.label} className="md:col-span-3">
            <MetricCard tile={m} />
          </div>
        ))}
      </div>

      {/* Row 2: Donut + AI insights */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <Card title="Question Breakdown" className="md:col-span-4">
          <div className="h-64 flex items-center justify-center">
            <Doughnut data={donutData} options={donutOptions} />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="w-3 h-3 bg-primary rounded-full mx-auto mb-1" />
              <p className="text-[10px] text-on-surface-variant uppercase">Correct</p>
              <p className="font-label-lg text-label-lg">{analysis.correctCount}</p>
            </div>
            <div>
              <div className="w-3 h-3 bg-error rounded-full mx-auto mb-1" />
              <p className="text-[10px] text-on-surface-variant uppercase">Incorrect</p>
              <p className="font-label-lg text-label-lg">{analysis.incorrectCount}</p>
            </div>
            <div>
              <div className="w-3 h-3 bg-surface-container-highest rounded-full mx-auto mb-1" />
              <p className="text-[10px] text-on-surface-variant uppercase">Skipped</p>
              <p className="font-label-lg text-label-lg">{analysis.skippedCount}</p>
            </div>
          </div>
        </Card>

        <AIInsightBanner
          tone="primary-container"
          title="AI Strategic Insights"
          className="md:col-span-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <InsightPill
              tone="text-secondary-fixed"
              icon="trending_up"
              heading="Strengths"
              body="Your logic and deduction speed is in the 98th percentile. Complex probability puzzles are a breeze for you."
              bodyClass="text-primary-fixed"
            />
            <InsightPill
              tone="text-error-container"
              icon="priority_high"
              heading="Weaknesses"
              body="Calculus-based problems took 40% longer than your average. Error rate increases in multi-step equations."
              bodyClass="text-primary-fixed"
            />
            <InsightPill
              tone="text-tertiary-fixed"
              icon="auto_fix_high"
              heading="Focus Areas"
              bodyClass="text-primary-fixed"
            >
              <ul className="text-body-md font-body-md space-y-2 text-primary-fixed">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-xs mt-1">circle</span>
                  Integration by Parts
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-xs mt-1">circle</span>
                  Vector Calculus Logic
                </li>
              </ul>
            </InsightPill>
          </div>
          <div className="mt-8 flex justify-end">
            <Link
              to={pathFor('practice')}
              className="bg-surface-container-lowest text-primary px-6 py-3 rounded-full font-label-lg text-label-lg flex items-center gap-2 hover:scale-105 transition-transform"
            >
              Generate Personalized Study Plan
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </AIInsightBanner>
      </div>

      {/* Row 3: Topic + Difficulty */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <Card title="Topic Performance Accuracy" className="md:col-span-7">
          <div className="h-[300px]">
            <Bar data={barData} options={barOptions} />
          </div>
        </Card>

        <Card title="Difficulty Breakdown" className="md:col-span-5">
          <div className="space-y-8">
            {analysis.difficulty.map((d) => {
              const pct = Math.round((d.solved / d.total) * 100);
              return (
                <div key={d.level} className="space-y-2">
                  <div className="flex justify-between font-label-lg text-label-lg">
                    <span className="text-on-surface-variant">{d.level} Questions</span>
                    <span className="text-primary font-bold">{pct}% Correct</span>
                  </div>
                  <ProgressBar
                    percent={pct}
                    barClass={d.barClass}
                    trackClass="bg-surface-container-highest"
                    withLabel={false}
                  />
                  <p className="text-body-md text-on-surface-variant text-right">
                    {d.solved} of {d.total} solved
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recommended Material */}
      <section>
        <h3 className="font-headline-lg text-headline-lg text-primary mb-6">
          Recommended Material
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <RecommendCard
            badge="Video Lesson"
            badgeClass="bg-secondary text-on-secondary"
            title="Advanced Integration Masterclass"
            subtitle="Focuses on multi-step variable calculus."
            imageAlt="tablet with math formulas"
          />
          <RecommendCard
            badge="Practice Set"
            badgeClass="bg-tertiary-fixed-dim text-on-tertiary-fixed"
            title="Analytical Logic Puzzles Vol 2."
            subtitle="150 questions on deductive reasoning."
            imageAlt="notebook with geometric sketches"
          />
          <Link
            to={pathFor('practice')}
            className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-2xl p-6 bg-surface-container-low hover:bg-surface-container-high transition-colors text-center"
          >
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3">
              add_circle
            </span>
            <span className="font-label-lg text-label-lg text-on-surface">
              Explore All Recommendations
            </span>
            <p className="text-[10px] text-on-surface-variant mt-2">
              Personalized based on Mock #42
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}

interface InsightPillProps {
  tone: string;
  icon: string;
  heading: string;
  body?: string;
  bodyClass?: string;
  children?: React.ReactNode;
}

function InsightPill({ tone, icon, heading, body, bodyClass, children }: InsightPillProps) {
  return (
    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
      <div className={`flex items-center gap-2 mb-3 ${tone}`}>
        <span className="material-symbols-outlined">{icon}</span>
        <span className="font-label-lg text-label-lg">{heading}</span>
      </div>
      {body ? <p className={`text-body-md font-body-md leading-relaxed ${bodyClass ?? ''}`}>{body}</p> : children}
    </div>
  );
}

interface RecommendCardProps {
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  imageAlt: string;
}

function RecommendCard({ badge, badgeClass, title, subtitle }: RecommendCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-surface-container-lowest border border-outline-variant hover:shadow-xl transition-all cursor-pointer">
      <div className="aspect-video w-full bg-surface-container-highest relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
        <span className={`absolute bottom-3 left-3 ${badgeClass} px-2 py-1 rounded text-[10px] font-bold uppercase`}>
          {badge}
        </span>
      </div>
      <div className="p-4">
        <h4 className="font-label-lg text-label-lg text-on-surface group-hover:text-secondary transition-colors">
          {title}
        </h4>
        <p className="text-body-md text-on-surface-variant mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
