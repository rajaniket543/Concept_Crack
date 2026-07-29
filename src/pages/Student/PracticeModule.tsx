import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { getAuthSession } from '../../lib/auth';
import { getStudentDashboard } from '../../lib/db';
import { getStudentStream } from '../../lib/stream';
import { getChaptersForSubject, type ChapterInfo } from '../../lib/questions';
import { isCanonicalTopic } from '../../lib/syllabus';

interface AIRecommendation {
  title: string;
  subject: string;
  rationale: string;
  durationMins: number;
}

interface WeakArea {
  name: string;   // chapter
  note: string;   // subject
  percent: number;
}

// Distinct hues per subject — Physics (blue) and Chemistry (orange) are kept far
// apart on the colour wheel so they never read as the same (5c).
const SUBJECT_META: Record<string, { color: string; bg: string; icon: string; gradient: string }> = {
  Physics:     { color: '#2563EB', bg: 'rgba(37,99,235,0.10)',   icon: 'electric_bolt', gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)' },
  Chemistry:   { color: '#F97316', bg: 'rgba(249,115,22,0.10)',  icon: 'science',       gradient: 'linear-gradient(135deg, #EA580C, #F97316)' },
  Mathematics: { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  icon: 'calculate',     gradient: 'linear-gradient(135deg, #059669, #10B981)' },
  Biology:     { color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  icon: 'biotech',       gradient: 'linear-gradient(135deg, #7C3AED, #8B5CF6)' },
};

const SUBJECT_DESC: Record<string, string> = {
  Physics:     'Mechanics, Electromagnetism, Optics',
  Chemistry:   'Organic, Inorganic, Physical Chem',
  Mathematics: 'Calculus, Algebra, Trigonometry',
  Biology:     'Botany, Zoology, Human Physiology',
};

interface ChapterGroup {
  key: string;
  displayName: string;
  items: ChapterInfo[];
  totalQuestions: number;
}

// Faculty enter chapter names as free text, so the same real topic often ends
// up as several near-identical rows ("Thermodynamics" / "thermodynamics ").
// Group them visually by normalized name — the real underlying chapter
// records (and their real question sets) stay distinct and are only chosen
// from once a group with more than one variant is opened.
function groupChaptersByName(items: ChapterInfo[]): ChapterGroup[] {
  const order: string[] = [];
  const map = new Map<string, ChapterInfo[]>();
  items.forEach(c => {
    const key = c.chapter.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(c);
  });
  return order.map(key => {
    const group = map.get(key)!;
    return {
      key,
      displayName: group[0].chapter,
      items: group,
      totalQuestions: group.reduce((sum, c) => sum + c.questionCount, 0),
    };
  });
}

export default function PracticeModule() {
  const stream = getStudentStream();
  const thirdSubject = stream === 'NEET' ? 'Biology' : 'Mathematics';
  const subjects = ['Physics', 'Chemistry', thirdSubject];

  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [otherOpenBySubject, setOtherOpenBySubject] = useState<Record<string, boolean>>({});

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
          // Drop recommendations that aren't real JEE/NEET syllabus topics for
          // their subject (e.g. a stray mock-test section label) before
          // surfacing them as an "AI recommendation" — a wrong-looking
          // recommendation is worse than a missing one.
          const realRecs = ((payload.aiRecommendations ?? []) as AIRecommendation[])
            .filter(r => isCanonicalTopic(r.subject, r.title));
          setRecommendations(realRecs.slice(0, 4));
          setWeakAreas((payload.weakAreas ?? []) as WeakArea[]);
        })
        .catch(() => {
          if (cancelled) return;
          setRecommendations([]);
          setWeakAreas([]);
        });
    } else {
      setRecommendations([]);
      setWeakAreas([]);
    }

    return () => { cancelled = true; };
  // subjects array is derived from stream which is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  const filtered = chapters.filter(c =>
    !activeSubject || c.subject === activeSubject
  );

  // Real AI-recommended chapter names per subject — weak topics (from actual
  // attempt history) plus the AI recommendation cards above, so selecting a
  // subject leads with what's actually worth practicing rather than every
  // chapter in the syllabus.
  const recommendedNamesBySubject = subjects.reduce((acc, s) => {
    const fromWeak = weakAreas.filter(w => w.note === s).map(w => w.name);
    const fromRecs = recommendations.filter(r => r.subject === s).map(r => r.title);
    acc[s] = new Set([...fromWeak, ...fromRecs]);
    return acc;
  }, {} as Record<string, Set<string>>);

  const groupedBySubject = subjects.reduce((acc, s) => {
    const all = filtered.filter(c => c.subject === s);
    const recommended = recommendedNamesBySubject[s] ?? new Set<string>();
    acc[s] = [...all].sort((a, b) => {
      const aRec = recommended.has(a.chapter) ? 0 : 1;
      const bRec = recommended.has(b.chapter) ? 0 : 1;
      return aRec - bRec;
    });
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
            const count = groupChaptersByName(groupedBySubject[s] ?? []).length;
            const isActive = activeSubject === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => { setActiveSubject(isActive ? null : s); setShowAllChapters(false); }}
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
          const recommendedNames = recommendedNamesBySubject[subj] ?? new Set<string>();
          const isFocused = activeSubject === subj;
          const recommendedItems = items.filter(c => recommendedNames.has(c.chapter));
          // When a subject is actively selected and it has AI-recommended chapters,
          // lead with just those by default rather than dumping the whole syllabus —
          // "Show all" reveals the rest, so nothing real is ever hidden for good.
          const visibleItems = isFocused && recommendedItems.length > 0 && !showAllChapters
            ? recommendedItems
            : items;
          // Only real JEE/NEET syllabus topics show in the main grid; anything
          // that doesn't match the real curriculum (stray labels, mislabelled
          // subjects) is grouped separately rather than mixed in or deleted.
          const syllabusItems = visibleItems.filter(c => isCanonicalTopic(subj, c.chapter));
          const otherItems = visibleItems.filter(c => !isCanonicalTopic(subj, c.chapter));
          const otherOpen = otherOpenBySubject[subj] ?? false;
          return (
            <div key={subj}>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: meta.color }}>{meta.icon}</span>
                </div>
                <h2 className="text-title-lg font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{subj}</h2>
                <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.bg, color: meta.color }}>
                  {visibleItems.length === items.length ? `${items.length} chapters` : `${visibleItems.length} of ${items.length} chapters`}
                </span>
                {isFocused && recommendedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllChapters(v => !v)}
                    className="text-label-sm font-semibold hover:underline ml-auto"
                    style={{ color: meta.color }}
                  >
                    {showAllChapters ? 'Show recommended only' : `Show all ${items.length} chapters`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupChaptersByName(syllabusItems).map(group => (
                  group.items.length === 1 ? (
                    <ChapterCard key={group.items[0].id} chapter={group.items[0]} meta={meta} recommended={recommendedNames.has(group.items[0].chapter)} />
                  ) : (
                    <ChapterGroupCard key={group.key} group={group} meta={meta} recommended={group.items.some(c => recommendedNames.has(c.chapter))} />
                  )
                ))}
                {syllabusItems.length === 0 && (
                  <p className="text-body-sm col-span-full" style={{ color: 'var(--text-muted)' }}>No recognised syllabus topics found here yet.</p>
                )}
              </div>

              {otherItems.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setOtherOpenBySubject(prev => ({ ...prev, [subj]: !otherOpen }))}
                    className="text-label-sm font-semibold hover:underline flex items-center gap-1"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <span className="material-symbols-outlined transition-transform" style={{ fontSize: 16, transform: otherOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                    {otherOpen ? 'Hide' : 'Show'} {groupChaptersByName(otherItems).length} other topic{groupChaptersByName(otherItems).length === 1 ? '' : 's'} — not part of the JEE/NEET syllabus
                  </button>
                  {otherOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-3">
                      {groupChaptersByName(otherItems).map(group => (
                        group.items.length === 1 ? (
                          <ChapterCard key={group.items[0].id} chapter={group.items[0]} meta={meta} />
                        ) : (
                          <ChapterGroupCard key={group.key} group={group} meta={meta} />
                        )
                      ))}
                    </div>
                  )}
                </div>
              )}
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

function ChapterGroupCard({ group, meta, recommended }: { group: ChapterGroup; meta: { color: string; bg: string }; recommended?: boolean }) {
  const [open, setOpen] = useState(false);
  const examQuestions = Math.min(group.totalQuestions, 30);
  const durationMins  = Math.ceil(examQuestions * 1.5);

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 transition-all duration-200"
      style={{ backgroundColor: 'var(--surface)', border: `1px solid ${recommended ? meta.color : 'var(--border)'}`, boxShadow: 'var(--shadow-xs)' }}
    >
      <button type="button" onClick={() => setOpen(v => !v)} className="text-left flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.bg, color: meta.color }}>
            {group.items[0].subject}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-faint)' }}>
            {group.items.length} variants
          </span>
        </div>
        <div>
          <h3 className="text-body-md font-semibold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {group.displayName}
          </h3>
          <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{group.totalQuestions} questions across {group.items.length} entries</p>
        </div>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3 text-label-sm" style={{ color: 'var(--text-faint)' }}>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>quiz</span>{examQuestions}q</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>{durationMins}m</span>
          </div>
          <span className="material-symbols-outlined transition-transform" style={{ fontSize: '18px', color: meta.color, transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </div>
      </button>

      {open && (
        <div className="pt-1 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
          {group.items.map(ch => (
            <Link
              key={ch.id}
              to="/student/exam"
              state={{ subject: ch.subject, chapter: ch.chapter }}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-muted)]"
            >
              <span className="text-body-sm truncate" style={{ color: 'var(--text-secondary)' }}>{ch.chapter}</span>
              <span className="text-label-sm font-semibold shrink-0" style={{ color: meta.color }}>{ch.questionCount}q →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterCard({ chapter: ch, meta, recommended }: { chapter: ChapterInfo; meta: { color: string; bg: string }; recommended?: boolean }) {
  const examQuestions = Math.min(ch.questionCount, 30);
  const durationMins  = Math.ceil(examQuestions * 1.5);

  return (
    <Link
      to="/student/exam"
      state={{ subject: ch.subject, chapter: ch.chapter }}
      className="group rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1"
      style={{
        backgroundColor: 'var(--surface)',
        border: `1px solid ${recommended ? meta.color : 'var(--border)'}`,
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
        {recommended && (
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: meta.bg, color: meta.color }}>
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>auto_awesome</span>
            Recommended
          </span>
        )}
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
