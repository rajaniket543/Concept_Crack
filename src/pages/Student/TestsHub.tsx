import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { pathFor } from '../../lib/pages';

interface TestCardDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  path: string;
}

const TEST_CARDS: TestCardDef[] = [
  {
    key: 'assignedTests',
    title: 'Assigned Test',
    description: 'Tests set by your faculty or institute, with due dates and full syllabus alignment.',
    icon: 'assignment',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    path: pathFor('assignedTests'),
  },
  {
    key: 'customTest',
    title: 'Custom Test',
    description: 'Build a test from any subject, chapter, difficulty, and question-count combination.',
    icon: 'tune',
    color: 'var(--brand)',
    bg: 'var(--brand-muted)',
    path: pathFor('customTest'),
  },
  {
    key: 'aiTest',
    title: 'AI Test',
    description: 'Generated automatically from your weakest concepts — the fastest way to close real gaps.',
    icon: 'auto_awesome',
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.12)',
    path: pathFor('aiTest'),
  },
  {
    key: 'mockTest',
    title: 'Mock Test',
    description: 'A full-length exam-pattern mock, timed and scored exactly like the real thing.',
    icon: 'quiz',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    path: pathFor('mockTest'),
  },
  {
    key: 'pyq',
    title: 'Previous Year Papers',
    description: 'Real past-exam papers, organized by year — practice with the actual question style.',
    icon: 'history_edu',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    path: pathFor('pyq'),
  },
];

export default function TestsHub() {
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Tests' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Tests
          </h1>
          <p className="text-body-md mt-1 max-w-xl" style={{ color: 'var(--text-muted)' }}>
            Choose how you want to be tested today. Each format feeds straight back into your Growth graph and Subject Mastery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TEST_CARDS.map(t => (
            <Link
              key={t.key}
              to={t.path}
              className="card-hover flex flex-col gap-4"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: t.bg }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: t.color }}>{t.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-title-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t.title}</h3>
                <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.color }}>
                Open
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
