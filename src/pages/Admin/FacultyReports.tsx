import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { askAI, hasAI } from '../../lib/ai';
import AIMarkdown from '../../components/AIMarkdown';

const ACCENT = 'var(--admin-accent)';

// Real per-faculty effectiveness metrics, computed from the tests each faculty
// member created and the attempts students submitted on them (2s).

interface FacultyMetrics {
  id: string;
  name: string;
  email: string;
  stream: string;
  testsCreated: number;
  activeTests: number;
  studentsReached: number;   // unique students who attempted their tests
  attempts: number;
  avgScorePct: number;       // average accuracy across attempts
  conceptClarity: number;    // % of attempts with accuracy ≥ 60
  weakTopics: string[];      // chapters with the lowest performance
  hasData: boolean;
}

export default function FacultyReports() {
  const [faculty, setFaculty] = useState<FacultyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [userSnap, testSnap, attemptSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'tests')),
          getDocs(collection(db, 'testAttempts')),
        ]);
        if (cancelled) return;

        const tests = testSnap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));
        const attempts = attemptSnap.docs.map(d => d.data() as Record<string, unknown>);

        const rows: FacultyMetrics[] = userSnap.docs
          .filter(d => d.data().role === 'faculty')
          .map(d => {
            const u = d.data();
            const myTests = tests.filter(t => t.data.createdBy === d.id);
            const myTestIds = new Set(myTests.map(t => t.id));
            const myAttempts = attempts.filter(a => myTestIds.has(a.testId as string));
            const students = new Set(myAttempts.map(a => a.studentId as string));
            const accs = myAttempts.map(a => (a.accuracyPct as number) ?? 0);
            const avg = accs.length > 0 ? Math.round(accs.reduce((s, v) => s + v, 0) / accs.length) : 0;
            const clarity = accs.length > 0 ? Math.round((accs.filter(v => v >= 60).length / accs.length) * 100) : 0;

            // Weakest chapters across this faculty's tests (by the tests' chapter lists,
            // weighted by low-accuracy attempts).
            const chapterScores = new Map<string, { total: number; count: number }>();
            myAttempts.forEach(a => {
              const test = myTests.find(t => t.id === (a.testId as string));
              ((test?.data.chapters as string[]) ?? []).forEach(ch => {
                const cur = chapterScores.get(ch) ?? { total: 0, count: 0 };
                cur.total += (a.accuracyPct as number) ?? 0;
                cur.count += 1;
                chapterScores.set(ch, cur);
              });
            });
            const weakTopics = [...chapterScores.entries()]
              .map(([ch, { total, count }]) => ({ ch, avg: total / count }))
              .sort((a, b) => a.avg - b.avg)
              .slice(0, 3)
              .map(x => x.ch);

            return {
              id: d.id,
              name: (u.name as string) ?? 'Faculty',
              email: (u.email as string) ?? '',
              stream: (u.facultyStream as string) ?? (u.stream as string) ?? '—',
              testsCreated: myTests.length,
              activeTests: myTests.filter(t => t.data.status === 'active' || t.data.status === 'approved').length,
              studentsReached: students.size,
              attempts: myAttempts.length,
              avgScorePct: avg,
              conceptClarity: clarity,
              weakTopics,
              hasData: myAttempts.length > 0,
            };
          })
          .sort((a, b) => b.attempts - a.attempts);

        setFaculty(rows);
      } catch (e) {
        console.error('faculty reports load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function generate(f: FacultyMetrics) {
    setLoadingId(f.id);
    const prompt = `You are an academic performance analyst for Concept Crack (a JEE/NEET coaching platform).
Write a concise report (5-7 sentences) for the ADMIN about a faculty member's effectiveness, based on real platform data.

Faculty: ${f.name} — ${f.stream} batch
Tests created: ${f.testsCreated} (${f.activeTests} currently live)
Unique students who attempted their tests: ${f.studentsReached}
Total attempts recorded: ${f.attempts}
Average student accuracy on their tests: ${f.avgScorePct}%
Concept-clarity index (share of attempts scoring 60%+): ${f.conceptClarity}%
${f.weakTopics.length > 0 ? `Chapters where students score lowest: ${f.weakTopics.join(', ')}` : 'No chapter-level weak spots identified yet.'}

Assess: how are the students under this faculty performing? Are core concepts landing? ${f.attempts === 0 ? 'Note that no attempts are recorded yet, so focus on encouraging test creation and assignment.' : ''} End with 2 specific, actionable recommendations for the admin/faculty. Be professional and direct.`;

    let text: string;
    try {
      text = hasAI()
        ? await askAI(prompt, { maxTokens: 500 })
        : 'AI reports need an API key. Add VITE_GEMINI_API_KEY to enable AI-generated faculty reports.';
    } catch {
      text = 'Could not generate the report right now — please try again in a moment.';
    }
    setReports(prev => ({ ...prev, [f.id]: text }));
    setLoadingId(null);
  }

  const scoreColor = (v: number) => (v >= 75 ? '#10B981' : v >= 60 ? '#F59E0B' : '#EF4444');

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Faculty AI Reports' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Faculty AI Reports
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            AI-written performance analysis for each faculty member, built from their real tests and student attempts.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size={24} color={ACCENT} /></div>
        ) : faculty.length === 0 ? (
          <Card>
            <div className="py-10 text-center" style={{ color: 'var(--text-faint)' }}>
              <span className="material-symbols-outlined block mx-auto mb-2" style={{ fontSize: '30px' }}>co_present</span>
              No faculty accounts yet — create them from User Management.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {faculty.map(f => (
              <Card key={f.id}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: ACCENT }}>
                      {f.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{f.name}</div>
                      <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>
                        {f.stream} · {f.testsCreated} test{f.testsCreated !== 1 ? 's' : ''} · {f.studentsReached} student{f.studentsReached !== 1 ? 's' : ''} reached
                      </div>
                    </div>
                  </div>
                  {!f.hasData && (
                    <span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.10)', color: '#B45309' }}>No attempts yet</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Avg Accuracy', value: f.avgScorePct, suffix: '%' },
                    { label: 'Concept Clarity', value: f.conceptClarity, suffix: '%' },
                    { label: 'Attempts', value: f.attempts, suffix: '' },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                      <div className="text-lg font-bold" style={{ color: s.suffix === '%' ? scoreColor(s.value) : 'var(--text-primary)' }}>
                        {f.hasData || s.suffix === '' ? `${s.value}${s.suffix}` : '—'}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {f.weakTopics.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="text-label-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Weakest chapters:</span>
                    {f.weakTopics.map(t => (
                      <span key={t} className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>{t}</span>
                    ))}
                  </div>
                )}

                {reports[f.id] ? (
                  <div className="rounded-xl p-4 text-sm leading-relaxed" style={{ backgroundColor: 'var(--admin-accent-muted)', border: '1px solid rgba(236,72,153,0.15)', color: 'var(--text-secondary)' }}>
                    <AIMarkdown text={reports[f.id]} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void generate(f)}
                    disabled={loadingId === f.id}
                    className="btn-primary btn-md w-full justify-center"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, var(--admin-accent-hover))` }}
                  >
                    {loadingId === f.id ? <Spinner size={16} color="#fff" /> : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_awesome</span>}
                    {loadingId === f.id ? 'Analysing…' : 'Generate AI Report'}
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
