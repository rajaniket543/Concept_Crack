import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { getAuthSession } from '../../lib/auth';
import { getStudentDashboard } from '../../lib/db';
import { getStudentStream } from '../../lib/stream';
import { getChaptersForSubject, type ChapterInfo } from '../../lib/questions';

interface AIRecommendation {
  title: string;
  subject: string;
  rationale: string;
  durationMins: number;
}

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

export default function PracticeModule() {
  const stream = getStudentStream();
  const thirdSubject = stream === 'NEET' ? 'Biology' : 'Mathematics';
  const subjects = ['Physics', 'Chemistry', thirdSubject];

  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(subjects.map(s => getChaptersForSubject(s)))
      .then(results => {
        if (cancelled) return;
        setChapters(results.flat());
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    const uid = getAuthSession()?.user?.id;
    if (uid) {
      getStudentDashboard(uid)
        .then(payload => {
          if (cancelled) return;
          setRecommendations((payload.aiRecommendations ?? []).slice(0, 4) as AIRecommendation[]);
        })
        .catch(() => {
          if (cancelled) return;
          setRecommendations([]);
        });
    } else {
      setRecommendations([]);
    }

    return () => { cancelled = true; };
  // subjects array is derived from stream which is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  const filtered = chapters.filter(c =>
    !activeSubject || c.subject === activeSubject
  );

  const groupedBySubject = subjects.reduce((acc, s) => {
    acc[s] = filtered.filter(c => c.subject === s);
    return acc;
  }, {} as Record<string, ChapterInfo[]>);

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
              Topic-based questions from your study material
            </p>
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
                    {loading ? '…' : `${count} chapters`}
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

        {recommendations.length > 0 && (
          <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  AI Recommended Practice
                </h2>
                <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Focus on the topics that will move your score the fastest.
                </p>
              </div>
              <Link to="/student/insights" className="btn-outline btn-sm">
                View insights
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {recommendations.map(rec => {
                const subject = rec.subject || thirdSubject;
                const meta = SUBJECT_META[subject] ?? SUBJECT_META.Physics;
                return (
                  <button
                    key={`${rec.title}-${subject}`}
                    type="button"
                    onClick={() => setActiveSubject(subject)}
                    className="text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5"
                    style={{ backgroundColor: 'var(--surface-muted)', border: `1px solid ${activeSubject === subject ? meta.color : 'var(--border)'}` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.bg }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: meta.color }}>{meta.icon}</span>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--surface)', color: meta.color, border: `1px solid ${meta.color}20` }}>
                        {subject}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      {rec.title}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {rec.rationale}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{rec.durationMins} min</span>
                      <span className="text-label-sm font-semibold" style={{ color: meta.color }}>Focus this</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-5 animate-pulse"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', height: '140px' }}
              />
            ))}
          </div>
        )}

        {/* Chapter cards by subject */}
        {!loading && subjects.map(subj => {
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
                <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.bg, color: meta.color }}>{items.length} chapters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(ch => (
                  <ChapterCard key={ch.id} chapter={ch} meta={meta} />
                ))}
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">search_off</span>
            </div>
            <h3 className="empty-state-title">No chapters found</h3>
            <p className="empty-state-body">Run <code>python scripts/create_chapters.py</code> to populate chapter metadata.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChapterCard({ chapter: ch, meta }: { chapter: ChapterInfo; meta: { color: string; bg: string } }) {
  const examQuestions = Math.min(ch.questionCount, 30);
  const durationMins  = Math.ceil(examQuestions * 1.5);

  return (
    <Link
      to="/student/exam"
      state={{ subject: ch.subject, chapter: ch.chapter }}
      className="group rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ backgroundColor: meta.bg, color: meta.color }}
        >
          {ch.subject}
        </span>
      </div>

      <div>
        <h3 className="text-body-md font-semibold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {ch.chapter}
        </h3>
        <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
          {ch.questionCount} questions available
        </p>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-label-sm" style={{ color: 'var(--text-faint)' }}>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>quiz</span>
            {examQuestions}q
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
            {durationMins}m
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
