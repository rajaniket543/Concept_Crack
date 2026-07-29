import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getPYQTests, getStudentAttemptCounts, type Test } from '../../lib/tests';
import { getQuestionsByIds, dedupeQuestions, type ExamQuestion } from '../../lib/questions';
import { pathFor } from '../../lib/pages';
import MathText from '../../components/MathText';

type Screen = 'years' | 'subjects' | 'document';

const SUBJECT_ICON: Record<string, string> = {
  Physics: 'electric_bolt', Chemistry: 'science', Mathematics: 'calculate', Biology: 'biotech',
};

/** Pulls a 4-digit year (20xx) out of a paper title, e.g. "JEE Main 2026 —
 *  April 8 Shift 2" → 2026. Papers with no parseable year are grouped
 *  separately rather than dropped. */
function parseYear(title: string): number | null {
  const m = title.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default function PYQSection() {
  const navigate = useNavigate();
  const uid    = getAuthSession()?.user?.id ?? '';
  const stream = getStudentStream() ?? undefined;

  const [loading, setLoading] = useState(true);
  const [tests, setTests]     = useState<Test[]>([]);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  const [screen, setScreen]           = useState<Screen>('years');
  const [selectedYear, setSelectedYear] = useState<number | 'other' | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const [docLoading, setDocLoading] = useState(false);
  const [docQuestions, setDocQuestions] = useState<ExamQuestion[]>([]);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    Promise.all([getPYQTests(stream), getStudentAttemptCounts(uid)])
      .then(([t, counts]) => { setTests(t); setAttemptCounts(counts); })
      .finally(() => setLoading(false));
  }, [uid, stream]);

  function startPaper(t: Test) {
    navigate(pathFor('exam'), { state: { testId: t.id, examTitle: t.title } });
  }

  // Group papers by year, most recent first; unparseable titles go under "other".
  const byYear = useMemo(() => {
    const map = new Map<number | 'other', Test[]>();
    tests.forEach(t => {
      const y = parseYear(t.title) ?? 'other';
      const arr = map.get(y) ?? [];
      arr.push(t);
      map.set(y, arr);
    });
    return map;
  }, [tests]);

  const years = useMemo(() => {
    const nums = [...byYear.keys()].filter((y): y is number => typeof y === 'number').sort((a, b) => b - a);
    return byYear.has('other') ? [...nums, 'other' as const] : nums;
  }, [byYear]);

  const subjectsForYear = useMemo(() => {
    if (selectedYear === null) return [];
    const testsThisYear = byYear.get(selectedYear) ?? [];
    const set = new Set<string>();
    testsThisYear.forEach(t => t.subjects.forEach(s => set.add(s)));
    return [...set];
  }, [byYear, selectedYear]);

  function openYear(y: number | 'other') {
    setSelectedYear(y);
    setScreen('subjects');
  }

  async function openSubject(subject: string) {
    setSelectedSubject(subject);
    setScreen('document');
    setDocLoading(true);
    try {
      const testsThisYear = selectedYear !== null ? (byYear.get(selectedYear) ?? []) : [];
      const allIds = [...new Set(testsThisYear.flatMap(t => t.questionIds))];
      const qs = await getQuestionsByIds(allIds);
      const filtered = dedupeQuestions(qs.filter(q => (q.subject ?? '').trim() === subject.trim()));
      setDocQuestions(filtered);
    } finally {
      setDocLoading(false);
    }
  }

  function backToYears() { setScreen('years'); setSelectedYear(null); setSelectedSubject(null); }
  function backToSubjects() { setScreen('subjects'); setSelectedSubject(null); }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 h-32 animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-1.5 text-body-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>
          <button type="button" onClick={backToYears} className="hover:underline" style={{ color: screen === 'years' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: screen === 'years' ? 600 : 400 }}>
            Previous Year Papers
          </button>
          {screen !== 'years' && selectedYear !== null && (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              <button type="button" onClick={backToSubjects} className="hover:underline" style={{ color: screen === 'subjects' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: screen === 'subjects' ? 600 : 400 }}>
                {selectedYear === 'other' ? 'Other Papers' : selectedYear}
              </button>
            </>
          )}
          {screen === 'document' && selectedSubject && (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedSubject}</span>
            </>
          )}
        </div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {screen === 'years' ? 'Previous Year Papers' : screen === 'subjects' ? (selectedYear === 'other' ? 'Other Papers' : selectedYear) : selectedSubject}
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          {screen === 'years' && 'Pick a year to see the full papers available for it.'}
          {screen === 'subjects' && 'Pick a subject to read the complete paper with solutions.'}
          {screen === 'document' && 'Every question exactly as it appeared, with the correct answer and solution.'}
        </p>
      </div>

      {/* ═══ STEP 1 — Years ═══ */}
      {screen === 'years' && (
        years.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
            <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--text-faint)' }}>history_edu</span>
            <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>No papers available yet</p>
            <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>Check back soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {years.map(y => {
              const count = (byYear.get(y) ?? []).length;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => openYear(y)}
                  className="text-left rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--brand-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--brand)' }}>calendar_month</span>
                  </div>
                  <div className="text-xl font-bold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                    {y === 'other' ? 'Other Papers' : y}
                  </div>
                  <div className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{count} paper{count === 1 ? '' : 's'}</div>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* ═══ STEP 2 — Subjects ═══ */}
      {screen === 'subjects' && (
        <div className="space-y-3 mb-2">
          <p className="text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Give Test</p>
          {(byYear.get(selectedYear as number | 'other') ?? []).map(t => {
            const attempts = attemptCounts[t.id] ?? 0;
            return (
              <div
                key={t.id}
                className="rounded-2xl p-4 flex items-center gap-4 flex-wrap"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(180,83,9,0.10)', color: '#B45309' }}>PYQ</span>
                    <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(107,114,128,0.08)', color: 'var(--text-muted)' }}>{t.subjects.join(' · ')}</span>
                    <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: attempts > 0 ? 'rgba(59,130,246,0.10)' : 'rgba(107,114,128,0.08)', color: attempts > 0 ? '#2563EB' : 'var(--text-muted)' }}>
                      {attempts > 0 ? `${attempts} attempt${attempts === 1 ? '' : 's'}` : 'New'}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t.title}</h3>
                  <p className="text-label-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.questionCount} questions · {formatDuration(t.durationSeconds)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startPaper(t)}
                  className="btn-primary btn-md shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{attempts > 0 ? 'replay' : 'play_arrow'}</span>
                  {attempts > 0 ? 'Retake Test' : 'Give Test'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {screen === 'subjects' && (
        subjectsForYear.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
            <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>No subjects found for this year.</p>
          </div>
        ) : (
          <>
          <p className="text-label-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>Read Paper &amp; Solutions</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {subjectsForYear.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => void openSubject(s)}
                className="text-left rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--brand-muted)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--brand)' }}>{SUBJECT_ICON[s] ?? 'menu_book'}</span>
                </div>
                <div className="text-lg font-bold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{s}</div>
                <div className="text-label-sm font-semibold mt-2 flex items-center gap-1" style={{ color: 'var(--brand)' }}>
                  View paper & solutions
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                </div>
              </button>
            ))}
          </div>
          </>
        )
      )}

      {/* ═══ STEP 3 — Document + solutions ═══ */}
      {screen === 'document' && (
        docLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-5 h-40 animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
            ))}
          </div>
        ) : docQuestions.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
            <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>No {selectedSubject} questions found for this year.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {docQuestions.map((q, i) => (
              <div key={q.id} className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-label-sm font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand)' }}>Q{i + 1}</span>
                  {q.chapter && (
                    <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }}>{q.chapter}</span>
                  )}
                </div>
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="Question figure" className="rounded-lg max-h-56 mb-3" style={{ border: '1px solid var(--border)' }} />
                )}
                <p className="text-base leading-relaxed mb-3" style={{ color: 'var(--text-primary)' }}><MathText text={q.prompt} /></p>

                {q.questionType !== 'numeric' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {q.options.map(o => {
                      const isCorrect = q.answer === o.key;
                      return (
                        <div
                          key={o.key}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                          style={{
                            backgroundColor: isCorrect ? 'rgba(16,185,129,0.10)' : 'var(--surface-muted)',
                            border: `1px solid ${isCorrect ? 'rgba(16,185,129,0.35)' : 'var(--border)'}`,
                          }}
                        >
                          <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: isCorrect ? '#10B981' : 'var(--surface)', color: isCorrect ? '#fff' : 'var(--text-muted)' }}>{o.key}</span>
                          <span className="text-body-sm" style={{ color: 'var(--text-primary)' }}><MathText text={o.text} /></span>
                          {isCorrect && <span className="material-symbols-outlined ml-auto" style={{ fontSize: 16, color: '#10B981' }}>check_circle</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {q.questionType === 'numeric' && q.answer && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-label-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Answer:</span>
                    <span className="text-body-md font-bold" style={{ color: '#059669' }}>{q.answer}</span>
                  </div>
                )}

                {q.explanation ? (
                  <div className="rounded-xl p-3.5 mt-2" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <div className="text-label-sm font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Solution</div>
                    <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}><MathText text={q.explanation} /></p>
                  </div>
                ) : (
                  <p className="text-label-sm italic" style={{ color: 'var(--text-faint)' }}>No written solution available for this question yet.</p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
