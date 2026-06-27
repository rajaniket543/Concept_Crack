import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { practiceModules, type PracticeModuleItem, type Subject } from '../../mocks/student';
import { apiRequest } from '../../lib/api';
import { getStudentStream } from '../../lib/stream';

type Filter = 'all' | 'ai' | 'pyq';

const SUBJECT_META: Record<string, { color: string; bg: string; icon: string; gradient: string }> = {
  Physics:     { color: '#5B4FE8', bg: 'rgba(91,79,232,0.10)',   icon: 'electric_bolt', gradient: 'linear-gradient(135deg, #5B4FE8, #818CF8)' },
  Chemistry:   { color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  icon: 'science',       gradient: 'linear-gradient(135deg, #7C3AED, #8B5CF6)' },
  Mathematics: { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  icon: 'calculate',     gradient: 'linear-gradient(135deg, #059669, #10B981)' },
  Biology:     { color: '#14B8A6', bg: 'rgba(20,184,166,0.10)',  icon: 'biotech',       gradient: 'linear-gradient(135deg, #0D9488, #14B8A6)' },
};

const SUBJECT_DESC: Record<string, string> = {
  Physics:     'Mechanics, Electromagnetism, Optics',
  Chemistry:   'Organic, Inorganic, Physical Chem',
  Mathematics: 'Calculus, Algebra, Trigonometry',
  Biology:     'Botany, Zoology, Human Physiology',
};

const DIFF_BADGE: Record<string, { bg: string; color: string }> = {
  Easy:     { bg: 'rgba(16,185,129,0.10)',  color: '#059669' },
  Medium:   { bg: 'rgba(245,158,11,0.10)',  color: '#B45309' },
  Hard:     { bg: 'rgba(239,68,68,0.10)',   color: '#DC2626' },
  PYQ:      { bg: 'rgba(6,182,212,0.10)',   color: '#0891B2' },
  'AI Pick':{ bg: 'rgba(91,79,232,0.10)',   color: '#5B4FE8' },
};

export default function PracticeModule() {
  const stream = getStudentStream();
  const thirdSubject = stream === 'NEET' ? 'Biology' : 'Mathematics';
  const subjects = ['Physics', 'Chemistry', thirdSubject];

  const [filter, setFilter] = useState<Filter>('all');
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [modules, setModules] = useState<PracticeModuleItem[]>(practiceModules);

  useEffect(() => {
    void apiRequest<{ practiceModules: PracticeModuleItem[] }>('/api/student/practice')
      .then(payload => setModules(payload.practiceModules))
      .catch(() => setModules(practiceModules));
  }, []);

  // For NEET, treat mock 'Mathematics' data as 'Biology'
  const normalizedModules = modules.map(m =>
    stream === 'NEET' && m.subject === 'Mathematics' ? { ...m, subject: 'Biology' as Subject } : m
  );

  const filtered = normalizedModules.filter(m => {
    if (activeSubject && m.subject !== activeSubject) return false;
    if (filter === 'ai')  return m.badges?.includes('AI Pick');
    if (filter === 'pyq') return m.badges?.includes('PYQ');
    return true;
  });

  const groupedBySubject = subjects.reduce((acc, s) => {
    acc[s] = filtered.filter(m => m.subject === s);
    return acc;
  }, {} as Record<string, PracticeModuleItem[]>);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Practice' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Practice
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              Topic-based adaptive questions, PYQs, and AI-curated sets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="tab-pills">
              {([['all', 'All'], ['ai', '✦ AI Pick'], ['pyq', 'PYQ']] as [Filter, string][]).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFilter(key)} className={`tab-pill ${filter === key ? 'active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subject cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {subjects.map(s => {
            const meta = SUBJECT_META[s];
            const count = groupedBySubject[s]?.length ?? 0;
            const isActive = activeSubject === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setActiveSubject(isActive ? null : s)}
                className="rounded-xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: isActive ? meta.gradient : 'var(--surface)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                  boxShadow: isActive ? `0 8px 24px ${meta.color}40` : 'var(--shadow-xs)',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.20)' : meta.bg }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isActive ? '#fff' : meta.color }}>{meta.icon}</span>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={isActive ? { backgroundColor: 'rgba(255,255,255,0.20)', color: '#fff' } : { backgroundColor: meta.bg, color: meta.color }}
                  >
                    {count} topics
                  </span>
                </div>
                <div className="font-semibold text-base mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: isActive ? '#fff' : 'var(--text-primary)' }}>{s}</div>
                <div className="text-xs" style={{ color: isActive ? 'rgba(255,255,255,0.70)' : 'var(--text-muted)' }}>
                  {SUBJECT_DESC[s]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Practice modules by subject */}
        {subjects.map(subj => {
          const items = groupedBySubject[subj];
          if (!items?.length) return null;
          if (activeSubject && activeSubject !== subj) return null;
          const meta = SUBJECT_META[subj];
          return (
            <div key={subj}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: meta.color }}>{meta.icon}</span>
                </div>
                <h2 className="text-title-lg font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{subj}</h2>
                <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.bg, color: meta.color }}>{items.length} sets</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(m => (
                  <PracticeCard key={m.id ?? m.title} module={m} meta={meta} />
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">search_off</span>
            </div>
            <h3 className="empty-state-title">No practice sets found</h3>
            <p className="empty-state-body">Try changing the filter or subject selection.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeCard({ module: m, meta }: { module: PracticeModuleItem; meta: { color: string; bg: string } }) {
  const hasAI = m.badges?.includes('AI Pick');
  return (
    <Link
      to="/student/exam"
      className="group rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {m.badges?.map(b => {
            const d = DIFF_BADGE[b] ?? DIFF_BADGE['Easy'];
            return (
              <span key={b} className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: d.bg, color: d.color }}>{b}</span>
            );
          })}
        </div>
        {hasAI && (
          <span className="material-symbols-outlined filled shrink-0" style={{ fontSize: '16px', color: '#5B4FE8' }}>auto_awesome</span>
        )}
      </div>

      <div>
        <h3 className="text-body-md font-semibold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{m.title}</h3>
        <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{(m as any).description}</p>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-label-sm" style={{ color: 'var(--text-faint)' }}>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>quiz</span>
            {(m as any).questionCount ?? m.questions ?? 10}q
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
            {(m as any).durationMins ?? m.minutes ?? 15}m
          </span>
        </div>
        <span
          className="material-symbols-outlined transition-transform group-hover:translate-x-1"
          style={{ fontSize: '18px', color: meta.color }}
        >
          arrow_forward
        </span>
      </div>
    </Link>
  );
}
