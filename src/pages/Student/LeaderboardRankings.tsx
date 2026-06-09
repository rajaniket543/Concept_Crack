import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PodiumCard from './components/PodiumCard';
import RankTable from './components/RankTable';
import { leaderboard } from '../../mocks/student';
import { pathFor } from '../../lib/pages';
import { apiRequest } from '../../lib/api';

type Comparison = 'Global Rank' | 'Peer Comparison';
type Period = 'Daily' | 'Weekly' | 'Monthly';
type Subject = 'Physics' | 'Mathematics' | 'AI & Ethics';

export default function LeaderboardRankings() {
  const [comparison, setComparison] = useState<Comparison>('Global Rank');
  const [batchPeriod, setBatchPeriod] = useState<Period>('Weekly');
  const [subjectName, setSubjectName] = useState<Subject>('AI & Ethics');
  const [data, setData] = useState(leaderboard);

  useEffect(() => {
    void apiRequest<typeof leaderboard>('/api/student/leaderboard')
      .then(setData)
      .catch(() => setData(leaderboard));
  }, []);

  return (
    <div className="p-gutter md:p-container-desktop space-y-stack-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-2">Academic Standings</h1>
          <p className="text-body-lg text-on-surface-variant max-w-xl">
            Track your progress against the global community. Real-time data powered by PrepMind AI
            analysis.
          </p>
        </div>
        <div className="inline-flex bg-surface-container-low p-1 rounded-full border border-outline-variant">
          {(['Global Rank', 'Peer Comparison'] as Comparison[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setComparison(c)}
              className={[
                'px-6 py-2 text-label-lg font-label-lg rounded-full transition-colors',
                comparison === c
                  ? 'bg-white shadow-sm text-primary'
                  : 'text-on-surface-variant hover:text-primary',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Podium + Your Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-8 bg-white border border-outline-variant rounded-xl p-card flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1/2 podium-gradient pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start mb-8">
            <h2 className="font-title-lg text-title-lg text-on-surface">Overall Rank — Top 3</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-4 py-1 bg-surface-container text-label-md font-label-md rounded-lg text-on-surface-variant border border-outline-variant/50"
              >
                Weekly
              </button>
              <span className="material-symbols-outlined text-on-surface-variant">
                filter_list
              </span>
            </div>
          </div>
          <div className="relative z-10 flex items-end justify-center gap-4 md:gap-12 pt-12 pb-4">
            {data.podium.map((p) => (
              <PodiumCard key={p.rank} entry={p} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-primary-container text-on-primary rounded-xl p-card flex flex-col shadow-lg border border-primary-container/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-title-lg text-title-lg">Your Performance</h2>
            <span className="material-symbols-outlined opacity-60">trending_up</span>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[56px] font-bold leading-none">
                {data.userPerformance.rank}
              </span>
              <span className="text-on-primary-container font-label-lg">
                / {data.userPerformance.outOf.toLocaleString()}
              </span>
            </div>
            <p className="text-body-lg text-on-primary-container mb-8">
              {data.userPerformance.percentile}
            </p>
            <div className="space-y-4">
              <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-label-md opacity-80">Subject Mastery</span>
                  <span className="text-label-md font-bold">
                    {data.userPerformance.masteryPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tertiary-fixed"
                    style={{ width: `${data.userPerformance.masteryPct}%` }}
                  />
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-label-md opacity-80">Daily Streak</span>
                  <span className="text-label-md font-bold">
                    {data.userPerformance.streakDays} Days
                  </span>
                </div>
                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-fixed-dim"
                    style={{
                      width: `${Math.min(100, (data.userPerformance.streakDays / 30) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <Link
            to={pathFor('analysis')}
            className="mt-8 w-full py-3 bg-white text-primary font-label-lg text-label-lg rounded-xl hover:bg-surface-container transition-colors active:scale-95 duration-200 inline-flex items-center justify-center"
          >
            View Detailed Insights
          </Link>
        </div>
      </div>

      {/* Two Rank Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-gutter">
        <div>
          <div className="flex items-center justify-end mb-2">
            <select
              value={batchPeriod}
              onChange={(e) => setBatchPeriod(e.target.value as Period)}
              className="bg-surface-container-low border-outline-variant rounded-lg text-label-md font-label-md py-1 px-3"
            >
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>
          <RankTable
            title="Batch Rank"
            subtitle="Section A-12 · Engineering Finals"
            rows={data.batch}
            variant="points"
          />
          <div className="mt-2 text-center">
            <button
              type="button"
              className="text-primary font-label-lg text-label-lg hover:underline transition-all"
            >
              View All Batch Members
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-end mb-2">
            <select
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value as Subject)}
              className="bg-surface-container-low border-outline-variant rounded-lg text-label-md font-label-md py-1 px-3"
            >
              <option>Physics</option>
              <option>Mathematics</option>
              <option>AI &amp; Ethics</option>
            </select>
          </div>
          <RankTable
            title="Subject Rank"
            subtitle={`Comparing Performance in ${subjectName}`}
            rows={data.subject}
            variant="accuracy"
          />
          <div className="mt-2 text-center">
            <button
              type="button"
              className="text-primary font-label-lg text-label-lg hover:underline transition-all"
            >
              Explore Other Subjects
            </button>
          </div>
        </div>
      </div>

      {/* Motivational AI Insights Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-center bg-gradient-to-br from-primary to-primary-container rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute left-1/4 bottom-0 w-60 h-60 bg-secondary/10 rounded-full blur-2xl" />
        <div className="md:col-span-7 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full mb-6 border border-white/20">
            <span className="material-symbols-outlined text-[20px] text-tertiary-fixed">
              auto_awesome
            </span>
            <span className="text-label-md font-bold tracking-wide uppercase">
              AI Motivation Engine
            </span>
          </div>
          <h2 className="font-headline-lg md:text-display-lg text-headline-lg-mobile leading-tight mb-6">
            {data.motivation.headline}
          </h2>
          <p className="text-body-lg text-white/80 mb-8 max-w-lg">
            {data.motivation.body}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to={pathFor('practice')}
              className="px-8 py-3 bg-tertiary-fixed text-primary font-bold rounded-xl hover:shadow-lg hover:shadow-tertiary-fixed/20 transition-all active:scale-95"
            >
              Start Boost Session
            </Link>
            <Link
              to={pathFor('insights')}
              className="px-8 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all"
            >
              View Roadmap
            </Link>
          </div>
        </div>
        <div className="md:col-span-5 relative z-10 flex justify-center items-center h-full">
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-2xl animate-float">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-secondary flex items-center justify-center rounded-xl">
                <span className="material-symbols-outlined text-white">psychology</span>
              </div>
              <div>
                <h4 className="font-bold text-on-surface">Skill Projection</h4>
                <p className="text-label-md text-on-surface-variant">AI-Enhanced Forecast</p>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-on-surface text-label-md mb-2">
                  <span>Logic Reasoning</span>
                  <span>+14% Weekly</span>
                </div>
                <div className="h-2 w-48 bg-black/5 rounded-full">
                  <div className="h-full bg-secondary rounded-full w-[82%]" />
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg">
                <p className="text-label-md text-primary font-bold italic">
                  "Consistency is your greatest edge, David. Keep the streak alive!"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
