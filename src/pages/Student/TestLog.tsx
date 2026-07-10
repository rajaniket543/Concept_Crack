import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import Spinner from '../../components/Spinner';
import { getAuthSession } from '../../lib/auth';
import { getStudentAttempts, getTest, ATTEMPT_TYPE_META, type TestAttempt, type AttemptType } from '../../lib/tests';
import { getQuestionsByIds, type ExamQuestion } from '../../lib/questions';
import { askAI, hasAI } from '../../lib/ai';
import { useToast } from '../../components/Toast';

interface AttemptView extends TestAttempt {
  testTitle: string;
  subjects: string[];
  type: AttemptType;
}

// Category filter tabs, in display order.
const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all',              label: 'All' },
  { key: 'mock',             label: 'Mock' },
  { key: 'custom',           label: 'Custom' },
  { key: 'ai',               label: 'AI' },
  { key: 'battle',           label: 'Battle' },
  { key: 'practice',         label: 'Practice' },
  { key: 'faculty_batch',    label: 'Assigned' },
  { key: 'faculty_coaching', label: 'Coaching' },
];

interface ReviewQuestion {
  index: number;
  prompt: string;
  options: Array<{ key: string; text: string }>;
  correct: string | null;
  chosen: string | null;
  status: 'correct' | 'incorrect' | 'skipped';
}

export default function TestLog() {
  const toast = useToast();
  const uid = getAuthSession()?.user?.id ?? '';

  const [attempts, setAttempts] = useState<AttemptView[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [review, setReview]     = useState<Record<string, ReviewQuestion[]>>({});
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [filter, setFilter]     = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');
  const [analysis, setAnalysis] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');

  // Infer a category for older attempts saved before testType was stored.
  function inferType(a: TestAttempt): AttemptType {
    if (a.testType) return a.testType;
    if (a.testId.startsWith('battle:')) return 'battle';
    if (a.testId.startsWith('practice:')) return 'practice';
    return 'custom';
  }

  async function enrichAttempts(raw: TestAttempt[]): Promise<AttemptView[]> {
    return Promise.all(raw.map(async a => {
      // Prefer the denormalised fields; only fetch the Test doc for old attempts.
      let testTitle = a.testTitle ?? '';
      let subjects = a.subjects ?? [];
      if (!testTitle || subjects.length === 0) {
        const test = await getTest(a.testId).catch(() => null);
        testTitle = testTitle || test?.title || 'Test';
        subjects = subjects.length ? subjects : (test?.subjects ?? []);
      }
      return { ...a, testTitle, subjects, type: inferType(a) } as AttemptView;
    }));
  }

  const loadAttempts = useCallback(async (signal: { cancelled: boolean }) => {
    if (!uid) return;
    setLoading(true);
    setLoadError(false);
    try {
      const enriched = await enrichAttempts(await getStudentAttempts(uid));
      if (!signal.cancelled) setAttempts(enriched);
    } catch {
      // One retry — Firestore reads can fail transiently (network blip,
      // brief quota burst). Don't tell the student their history is empty
      // when the read itself might just have failed.
      try {
        await new Promise(r => setTimeout(r, 800));
        const enriched = await enrichAttempts(await getStudentAttempts(uid));
        if (!signal.cancelled) setAttempts(enriched);
      } catch (e2) {
        console.error('test log load failed after retry', e2);
        if (!signal.cancelled) setLoadError(true);
      }
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    const signal = { cancelled: false };
    void loadAttempts(signal);
    return () => { signal.cancelled = true; };
  }, [loadAttempts]);

  async function toggleReview(a: AttemptView) {
    if (openId === a.id) { setOpenId(null); return; }
    setOpenId(a.id);
    setFilter('all');
    if (review[a.id]) return;
    setReviewLoading(a.id);
    try {
      // Use the exact questions served for this attempt; fall back to the test doc.
      let ids = a.questionIds ?? [];
      if (ids.length === 0) {
        const test = await getTest(a.testId).catch(() => null);
        ids = test?.questionIds ?? [];
      }
      const questions = ids.length ? await getQuestionsByIds(ids) : [];
      const rows: ReviewQuestion[] = questions.map((q: ExamQuestion, i) => {
        const chosen = a.answers[String(i + 1)] ?? null;
        const correct = q.answer;
        const status: ReviewQuestion['status'] = !chosen ? 'skipped' : chosen === correct ? 'correct' : 'incorrect';
        return { index: i + 1, prompt: q.prompt, options: q.options, correct, chosen, status };
      });
      setReview(prev => ({ ...prev, [a.id]: rows }));
    } catch (e) {
      console.error(e);
      toast('Could not load the answer review for this test.', 'error');
    } finally {
      setReviewLoading(null);
    }
  }

  async function runAnalysis(a: AttemptView) {
    const rows = review[a.id];
    if (!rows) return;
    setAnalysing(a.id);
    const wrong = rows.filter(r => r.status === 'incorrect');
    const skipped = rows.filter(r => r.status === 'skipped');
    const prompt = `You are an encouraging JEE/NEET tutor. A student just reviewed a past test. Give a short performance analysis (4-6 sentences) and a focused revision plan.

Test: ${a.testTitle}
Subjects: ${a.subjects.join(', ') || 'Mixed'}
Score: ${a.score} · Accuracy: ${a.accuracyPct}%
Correct: ${a.correctCount} · Incorrect: ${a.incorrectCount} · Skipped: ${a.skippedCount}
Questions they got wrong (first 8):
${wrong.slice(0, 8).map(r => `- Q${r.index}: ${r.prompt.slice(0, 100)}`).join('\n') || '- none'}
Questions they skipped: ${skipped.length}

Point out the likely weak concepts, what to revise first, and one habit to fix. Be specific and motivating.`;
    let text: string;
    try {
      text = hasAI()
        ? await askAI(prompt, { maxTokens: 500 })
        : 'AI analysis needs a Gemini API key. Your accuracy on this test was ' + a.accuracyPct + '% — focus revision on the questions marked incorrect above.';
    } catch {
      text = 'Could not generate the analysis right now — please try again shortly.';
    }
    setAnalysis(prev => ({ ...prev, [a.id]: text }));
    setAnalysing(null);
  }

  // Category counts + filtered list.
  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    attempts.forEach(a => { c[a.type] = (c[a.type] ?? 0) + 1; });
    return c;
  }, [attempts]);

  const categoryBreakdown = useMemo(() => {
    const total = attempts.length || 1;
    return CATEGORIES
      .filter(c => c.key !== 'all')
      .map(c => {
        const count = catCounts[c.key] ?? 0;
        const meta = ATTEMPT_TYPE_META[c.key as AttemptType] ?? ATTEMPT_TYPE_META.custom;
        return {
          key: c.key,
          label: c.label,
          count,
          pct: Math.round((count / total) * 100),
          meta,
        };
      })
      .filter(item => item.count > 0);
  }, [attempts.length, catCounts]);

  const visibleAttempts = useMemo(
    () => category === 'all' ? attempts : attempts.filter(a => a.type === category),
    [attempts, category],
  );

  const summary = useMemo(() => {
    if (attempts.length === 0) return null;
    const avgAcc = Math.round(attempts.reduce((s, a) => s + a.accuracyPct, 0) / attempts.length);
    const best = Math.max(...attempts.map(a => a.accuracyPct));
    return { count: attempts.length, avgAcc, best };
  }, [attempts]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const fmtDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const STATUS_META = {
    correct:   { color: '#059669', bg: 'rgba(16,185,129,0.10)', label: 'Correct', icon: 'check_circle' },
    incorrect: { color: '#DC2626', bg: 'rgba(239,68,68,0.10)',  label: 'Incorrect', icon: 'cancel' },
    skipped:   { color: '#B45309', bg: 'rgba(245,158,11,0.10)', label: 'Skipped', icon: 'remove_circle' },
  } as const;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Review Tests' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Review Tests
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Every test you've attempted — mock, custom, AI, battle and practice — with answer review and AI analysis.
          </p>
        </div>

        {summary && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Tests Attempted', value: summary.count, icon: 'history_edu', color: '#5B4FE8' },
              { label: 'Average Accuracy', value: `${summary.avgAcc}%`, icon: 'target', color: '#10B981' },
              { label: 'Best Accuracy', value: `${summary.best}%`, icon: 'trophy', color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} className="card">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${s.color}1A` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: s.color }}>{s.icon}</span>
                </div>
                <div className="text-2xl font-bold font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{s.value}</div>
                <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {summary && categoryBreakdown.length > 0 && (
          <Card title="Category Breakdown" subtitle="See how your attempts are distributed across test types">
            <div className="space-y-3">
              {categoryBreakdown.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategory(item.key)}
                  className="rounded-xl p-4 text-left transition-all"
                  style={{
                    backgroundColor: category === item.key ? 'rgba(91,79,232,0.06)' : 'var(--surface-muted)',
                    border: `1px solid ${category === item.key ? '#5B4FE8' : 'var(--border)'}`,
                    boxShadow: category === item.key ? '0 0 0 1px rgba(91,79,232,0.08)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-label-sm font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" style={{ backgroundColor: item.meta.bg, color: item.meta.color }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{item.meta.icon}</span>
                        {item.meta.label}
                      </span>
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.count}</div>
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{item.pct}%</div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.meta.color }} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Category filter tabs (only categories that actually have attempts) */}
        {!loading && attempts.length > 0 && (
          <div className="tab-pills flex-wrap">
            {CATEGORIES.filter(c => c.key === 'all' || (catCounts[c.key] ?? 0) > 0).map(c => (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)} className={`tab-pill ${category === c.key ? 'active' : ''}`}>
                {c.label} ({c.key === 'all' ? attempts.length : (catCounts[c.key] ?? 0)})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size={24} color="#5B4FE8" /></div>
        ) : loadError ? (
          <Card>
            <div className="py-12 text-center" style={{ color: 'var(--text-faint)' }}>
              <span className="material-symbols-outlined block mx-auto mb-2" style={{ fontSize: '32px', color: '#DC2626' }}>cloud_off</span>
              <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>Couldn't load your test history</p>
              <p className="text-body-sm mt-1">This is a connection issue, not necessarily missing data — your results may still be saved.</p>
              <button
                type="button"
                onClick={() => void loadAttempts({ cancelled: false })}
                className="btn-primary btn-sm mt-4"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              >
                Retry
              </button>
            </div>
          </Card>
        ) : attempts.length === 0 ? (
          <Card>
            <div className="py-12 text-center" style={{ color: 'var(--text-faint)' }}>
              <span className="material-symbols-outlined block mx-auto mb-2" style={{ fontSize: '32px' }}>history_edu</span>
              <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>No completed tests yet.</p>
              <p className="text-body-sm mt-1">Complete a test and it will show up here for review.</p>
            </div>
          </Card>
        ) : visibleAttempts.length === 0 ? (
          <Card><div className="py-10 text-center text-body-sm" style={{ color: 'var(--text-faint)' }}>No {category} tests yet.</div></Card>
        ) : (
          <div className="space-y-3">
            {visibleAttempts.map(a => {
              const isOpen = openId === a.id;
              const rows = review[a.id];
              const filtered = rows ? (filter === 'all' ? rows : rows.filter(r => r.status === filter)) : [];
              const accColor = a.accuracyPct >= 70 ? '#059669' : a.accuracyPct >= 40 ? '#B45309' : '#DC2626';
              const typeMeta = ATTEMPT_TYPE_META[a.type] ?? ATTEMPT_TYPE_META.custom;
              return (
                <div key={a.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {/* Summary row */}
                  <button type="button" onClick={() => void toggleReview(a)} className="w-full flex items-center gap-4 p-5 text-left">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: `${accColor}1A` }}>
                      <span className="text-base font-bold leading-none" style={{ color: accColor }}>{a.accuracyPct}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-label-sm font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{typeMeta.icon}</span>
                          {typeMeta.label}
                        </span>
                        <span className="text-body-md font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.testTitle}</span>
                      </div>
                      <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>
                        {a.subjects.join(', ') || 'Mixed'} · {fmtDate(a.submittedAt)}
                        {' · '}{a.correctCount + a.incorrectCount + a.skippedCount} questions
                        {' · '}{fmtDuration(a.timeSeconds)}
                        {a.rank ? ` · Rank #${a.rank}` : ''}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      <Stat label="Score" value={a.score} color="var(--text-primary)" />
                      <Stat label="Correct" value={a.correctCount} color="#059669" />
                      <Stat label="Wrong" value={a.incorrectCount} color="#DC2626" />
                      <Stat label="Skipped" value={a.skippedCount} color="#B45309" />
                    </div>
                    <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>expand_more</span>
                  </button>

                  {/* Expanded review */}
                  {isOpen && (
                    <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
                      {reviewLoading === a.id ? (
                        <div className="flex items-center justify-center py-8"><Spinner size={20} color="#5B4FE8" /></div>
                      ) : rows && rows.length > 0 ? (
                        <>
                          {/* AI analysis */}
                          {analysis[a.id] ? (
                            <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: 'rgba(91,79,232,0.05)', border: '1px solid rgba(91,79,232,0.18)', color: 'var(--text-secondary)' }}>
                              <div className="flex items-center gap-2 mb-1.5 text-label-sm font-bold uppercase tracking-widest" style={{ color: '#5B4FE8' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_awesome</span> AI Analysis
                              </div>
                              {analysis[a.id]}
                            </div>
                          ) : (
                            <button type="button" onClick={() => void runAnalysis(a)} disabled={analysing === a.id} className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                              {analysing === a.id ? <Spinner size={14} color="#fff" /> : <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_awesome</span>}
                              {analysing === a.id ? 'Analysing…' : 'Get AI Analysis'}
                            </button>
                          )}

                          {/* Filter pills */}
                          <div className="tab-pills flex-wrap">
                            {(['all', 'incorrect', 'skipped', 'correct'] as const).map(f => (
                              <button key={f} type="button" onClick={() => setFilter(f)} className={`tab-pill ${filter === f ? 'active' : ''}`}>
                                {f === 'all' ? `All (${rows.length})` : `${f[0].toUpperCase()}${f.slice(1)} (${rows.filter(r => r.status === f).length})`}
                              </button>
                            ))}
                          </div>

                          {/* Questions */}
                          <div className="space-y-3">
                            {filtered.map(r => {
                              const meta = STATUS_META[r.status];
                              return (
                                <div key={r.index} className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.index}. {r.prompt}</p>
                                    <span className="text-label-sm font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" style={{ backgroundColor: meta.bg, color: meta.color }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{meta.icon}</span>
                                      {meta.label}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {r.options.map(o => {
                                      const isCorrect = o.key === r.correct;
                                      const isChosen = o.key === r.chosen;
                                      return (
                                        <div key={o.key} className="text-xs flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                                          style={{
                                            backgroundColor: isCorrect ? 'rgba(16,185,129,0.10)' : isChosen ? 'rgba(239,68,68,0.10)' : 'var(--surface)',
                                            border: `1px solid ${isCorrect ? 'rgba(16,185,129,0.30)' : isChosen ? 'rgba(239,68,68,0.30)' : 'var(--border)'}`,
                                            color: isCorrect ? '#059669' : isChosen ? '#DC2626' : 'var(--text-muted)',
                                          }}>
                                          <span className="font-bold">{o.key}.</span>
                                          <span className="flex-1">{o.text}</span>
                                          {isCorrect && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>}
                                          {isChosen && !isCorrect && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {r.status === 'incorrect' && (
                                    <div className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
                                      You chose <strong style={{ color: '#DC2626' }}>{r.chosen}</strong> · Correct answer is <strong style={{ color: '#059669' }}>{r.correct ?? '—'}</strong>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {filtered.length === 0 && (
                              <p className="text-center text-body-sm py-4" style={{ color: 'var(--text-faint)' }}>No {filter} questions in this test.</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-center text-body-sm py-6" style={{ color: 'var(--text-faint)' }}>
                          Answer review isn't available for this attempt.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-base font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{label}</div>
    </div>
  );
}
