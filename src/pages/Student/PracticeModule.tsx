import { useState } from 'react';
import { Link } from 'react-router-dom';
import { practiceModules, type PracticeModuleItem, type PracticeBadge } from '../../mocks/student';

type Filter = 'all' | 'ai' | 'pyq';

const BADGE_CLASS: Record<PracticeBadge, string> = {
  Hard: 'bg-error-container text-on-error-container',
  Medium: 'bg-secondary-fixed text-on-secondary-fixed',
  Easy: 'bg-surface-container-highest text-on-surface-variant',
  PYQ: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'AI Pick': 'bg-primary-fixed text-on-primary-fixed-variant',
};

const SUBJECT_HERO: Array<{
  key: 'Physics' | 'Chemistry' | 'Mathematics';
  title: string;
  description: string;
  topicCount: string;
  hero?: boolean;
}> = [
  {
    key: 'Physics',
    title: 'Physics',
    description: 'Quantum Mechanics & Electromagnetism',
    topicCount: '24 Topics',
    hero: true,
  },
  {
    key: 'Chemistry',
    title: 'Chemistry',
    description: 'Organic & Inorganic',
    topicCount: '12 Topics',
  },
  {
    key: 'Mathematics',
    title: 'Mathematics',
    description: 'Calculus & Algebra',
    topicCount: '18 Topics',
  },
];

const SUBJECT_ICON: Record<'Physics' | 'Chemistry' | 'Mathematics', string> = {
  Physics: 'electric_bolt',
  Chemistry: 'science',
  Mathematics: 'calculate',
};

const HERO_BG = 'bg-primary-container';
const HERO_TEXT = 'text-white';
const HERO_SUBTLE = 'text-on-primary-container';

export default function PracticeModule() {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered: PracticeModuleItem[] = practiceModules.filter((m) => {
    if (filter === 'ai') return m.badges.includes('AI Pick');
    if (filter === 'pyq') return m.badges.includes('PYQ');
    return true;
  });

  return (
    <div className="p-container-desktop space-y-stack-lg">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
        <Link to="/student" className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">dashboard</span>
          Dashboard
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-primary font-bold">Practice</span>
      </nav>

      {/* Subject Selection */}
      <div>
        <h2 className="font-headline-lg text-headline-lg mb-6 tracking-tight">Select Subject</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {SUBJECT_HERO.map((s) => (
            <div
              key={s.key}
              className={[
                'group relative overflow-hidden rounded-2xl p-6 h-64 flex flex-col justify-between transition-all cursor-pointer',
                s.hero
                  ? `${HERO_BG} ${HERO_TEXT} md:col-span-1 hover:shadow-2xl`
                  : 'bg-surface-container text-on-surface hover:bg-secondary-container hover:shadow-xl',
              ].join(' ')}
            >
              <div className="flex justify-between items-start">
                <div
                  className={[
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    s.hero
                      ? 'bg-white/10 backdrop-blur-md'
                      : 'bg-on-tertiary-container/10 group-hover:bg-on-secondary-container/20',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'material-symbols-outlined',
                      s.hero ? 'text-white' : 'text-primary',
                    ].join(' ')}
                  >
                    {SUBJECT_ICON[s.key]}
                  </span>
                </div>
                <span className="font-label-md text-label-md bg-white/30 text-on-surface px-2 py-1 rounded">
                  {s.topicCount}
                </span>
              </div>
              <div>
                <h3
                  className={[
                    s.hero ? 'font-headline-lg text-headline-lg text-white' : 'font-title-lg text-title-lg group-hover:text-white',
                  ].join(' ')}
                >
                  {s.title}
                </h3>
                <p
                  className={[
                    'text-body-md',
                    s.hero
                      ? `${HERO_SUBTLE} opacity-80`
                      : 'text-on-surface-variant group-hover:text-secondary-fixed opacity-70',
                  ].join(' ')}
                >
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Curriculum */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg tracking-tight">Active Curriculum</h2>
          <p className="text-on-surface-variant font-body-md text-body-md">
            Personalized practice sessions based on your learning gap.
          </p>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
          <FilterPill
            active={filter === 'ai'}
            onClick={() => setFilter('ai')}
            icon="auto_awesome"
            label="AI Recommended"
            activeClass="border-primary text-primary"
          />
          <FilterPill
            active={filter === 'pyq'}
            onClick={() => setFilter('pyq')}
            icon="history_edu"
            label="PYQ Only"
            activeClass="border-primary text-primary"
          />
          <button
            type="button"
            aria-label="More filters"
            className="flex items-center justify-center w-10 h-10 rounded-full border border-outline-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined">filter_list</span>
          </button>
        </div>
      </div>

      {/* Topic list */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((m) => (
          <div
            key={m.id}
            className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6 group hover:border-primary/50 transition-all shadow-sm border border-outline-variant"
          >
            <div className="w-16 h-16 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-3xl">{m.icon}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h4 className="font-title-lg text-title-lg">{m.title}</h4>
                {m.badges.map((b) => (
                  <span
                    key={b}
                    className={`px-2 py-0.5 rounded font-label-md text-label-md ${BADGE_CLASS[b]}`}
                  >
                    {b}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-body-md">question_answer</span>
                  <span className="font-label-md text-label-md">{m.questions} Questions</span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-body-md">timer</span>
                  <span className="font-label-md text-label-md">{m.minutes} Mins</span>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[260px]">
                  <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                  <span
                    className={[
                      'font-label-md text-label-md',
                      m.progress === 100 ? 'text-on-tertiary-container' : 'text-primary',
                    ].join(' ')}
                  >
                    {m.progress === 100 ? 'Completed' : `${m.progress}% Done`}
                  </span>
                </div>
              </div>
            </div>
            {m.status === 'completed' ? (
            <Link
              to="/student/analysis"
              className="bg-surface-variant text-on-surface-variant px-8 py-3 rounded-xl font-label-lg text-label-lg transition-all hover:bg-outline-variant active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined">refresh</span>
              Review
            </Link>
          ) : (
            <Link
              to="/student/exam"
              className="bg-primary text-on-primary px-8 py-3 rounded-xl font-label-lg text-label-lg transition-all hover:shadow-lg active:scale-95 flex items-center gap-2 group-hover:pr-10 relative"
            >
              Start Practice
              <span className="material-symbols-outlined absolute right-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                play_arrow
              </span>
            </Link>
          )}
        </div>
      ))}
      </div>

      {/* AI Insight Banner */}
      <div className="bg-gradient-to-r from-primary-container to-secondary-container rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <div>
            <h3 className="font-headline-lg text-headline-lg leading-tight mb-2">Feeling Unsure?</h3>
            <p className="text-on-secondary-container text-body-lg opacity-90 max-w-md">
              Our AI analyzed your recent mock tests. We recommend starting with{' '}
              <b>Electrostatics</b> to improve your overall Physics percentile.
            </p>
          </div>
        </div>
        <Link
          to="/student/insights"
          className="bg-white text-primary px-8 py-4 rounded-full font-label-lg text-label-lg hover:shadow-xl transition-all active:scale-95 whitespace-nowrap"
        >
          Generate Custom Sprint
        </Link>
      </div>
    </div>
  );
}

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  activeClass?: string;
}

function FilterPill({ active, onClick, icon, label, activeClass = 'border-primary text-primary' }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-4 py-2 rounded-full font-label-lg text-label-lg transition-colors whitespace-nowrap border',
        active
          ? activeClass + ' bg-primary-fixed'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  );
}
