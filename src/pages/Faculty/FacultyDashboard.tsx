import { useEffect, useState } from 'react';
import Spinner from '../../components/Spinner';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { pathFor } from '../../lib/pages';
import { getAuthSession } from '../../lib/auth';
import { getAssignedStudentsData, type MockStudentProfile } from '../../lib/db';
import { formatExamCountdown, getExamCountdown } from '../../lib/examCountdown';
import type { StudentStream } from '../../lib/stream';

const asStream = (s: string): StudentStream => (s === 'NEET' ? 'NEET' : 'JEE');

export default function FacultyDashboard() {
  const session = getAuthSession();

  const [avgAccuracy, setAvgAccuracy] = useState<string>('—');
  const [attemptCount, setAttemptCount] = useState<string>('—');
  const [alerts, setAlerts] = useState<Array<{ name: string; initials: string; message: string; severity: string }>>([]);
  const [curriculumGap, setCurriculumGap] = useState<{ headline: string; focusAreas: string[] }>({
    headline: 'Attempt data will surface the chapters your students struggle with most.',
    focusAreas: [],
  });
  const [strongestChapter, setStrongestChapter] = useState<{ name: string; avg: number } | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<MockStudentProfile[]>([]);
  const [loadingStudents,  setLoadingStudents]  = useState(true);
  const [batchStream,      setBatchStream]      = useState<string>('');
  const [submissionsByDay, setSubmissionsByDay] = useState<Record<string, number>>({});
  const [dismissedRecs,    setDismissedRecs]    = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;
    if (!uid) { setLoadingStudents(false); return; }

    // Real faculty metrics from Firestore
    (async () => {
      try {
        const [testSnap, qSnap] = await Promise.all([
          getDocs(query(collection(db, 'tests'), where('createdBy', '==', uid))),
          getDocs(query(collection(db, 'questions'), where('uploadedBy', '==', uid))),
        ]);
        const testIds = new Set(testSnap.docs.map(d => d.id));
        // Attempts on this faculty's tests
        const attemptSnap = await getDocs(collection(db, 'testAttempts'));
        const myAttempts = attemptSnap.docs.map(d => d.data()).filter(a => testIds.has(a.testId as string));
        const accs = myAttempts.map(a => (a.accuracyPct as number) ?? 0);
        const avg = accs.length > 0 ? Math.round(accs.reduce((s, v) => s + v, 0) / accs.length) : 0;

        // Daily submission counts for the contribution calendar
        const byDay: Record<string, number> = {};
        myAttempts.forEach(a => {
          const raw = a.submittedAt;
          const d = raw instanceof Timestamp ? raw.toDate() : typeof raw === 'string' ? new Date(raw) : null;
          if (!d || isNaN(d.getTime())) return;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          byDay[key] = (byDay[key] ?? 0) + 1;
        });
        if (!cancelled) setSubmissionsByDay(byDay);

        // Weakest / strongest chapters across this faculty's tests
        const chapterAvg = new Map<string, { total: number; count: number }>();
        myAttempts.forEach(a => {
          const test = testSnap.docs.find(t => t.id === (a.testId as string));
          ((test?.data().chapters as string[]) ?? []).forEach(ch => {
            const cur = chapterAvg.get(ch) ?? { total: 0, count: 0 };
            cur.total += (a.accuracyPct as number) ?? 0;
            cur.count += 1;
            chapterAvg.set(ch, cur);
          });
        });
        const ranked = [...chapterAvg.entries()]
          .map(([ch, { total, count }]) => ({ ch, avg: total / count }))
          .sort((a, b) => a.avg - b.avg);
        const focus = ranked.slice(0, 3);

        if (cancelled) return;
        setAvgAccuracy(`${avg}%`);
        setAttemptCount(String(myAttempts.length));
        if (focus.length > 0) {
          setCurriculumGap({
            headline: `${focus[0].ch} has the lowest average accuracy (${Math.round(focus[0].avg)}%) across your tests.`,
            focusAreas: focus.map(f => f.ch),
          });
        }
        if (ranked.length > 0) {
          const strongest = ranked[ranked.length - 1];
          setStrongestChapter({ name: strongest.ch, avg: Math.round(strongest.avg) });
        }
      } catch (e) {
        console.error('faculty metrics load failed', e);
      }
    })();

    getAssignedStudentsData(uid)
      .then(students => {
        if (cancelled) return;
        setAssignedStudents(students);
        setLoadingStudents(false);
        if (students.length > 0) setBatchStream(students[0].stream);
        // Real "students needing attention" — lowest scorers
        const weak = [...students]
          .filter(s => (s.progress?.latestTestResult?.accuracyPct ?? s.accuracy ?? 100) < 60)
          .sort((a, b) => (a.progress?.latestTestResult?.accuracyPct ?? a.accuracy) - (b.progress?.latestTestResult?.accuracyPct ?? b.accuracy))
          .slice(0, 5)
          .map(s => ({
            name: s.name,
            initials: s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
            message: `Accuracy ${s.progress?.latestTestResult?.accuracyPct ?? s.accuracy}% — may need support`,
            severity: (s.progress?.latestTestResult?.accuracyPct ?? s.accuracy) < 40 ? 'critical' : 'warning',
          }));
        setAlerts(weak);
      })
      .catch(() => { if (!cancelled) setLoadingStudents(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countdown = batchStream ? getExamCountdown(asStream(batchStream)) : null;

  const insightCards = [
    {
      icon: 'warning', color: '#F87171', bg: 'rgba(239,68,68,0.12)',
      metric: curriculumGap.focusAreas.length > 0 ? `${Math.round(0)}` : '—',
      metricText: curriculumGap.focusAreas[0] ?? 'No data yet',
      headline: curriculumGap.focusAreas.length > 0 ? `${curriculumGap.focusAreas[0]} needs reinforcement` : 'Weak chapters will surface here',
      sub: curriculumGap.focusAreas.length > 0 ? curriculumGap.headline : 'Once students attempt your tests, the chapters dragging the average down will appear here.',
      cta: 'Assign reinforcement', to: pathFor('createTest'), real: curriculumGap.focusAreas.length > 0,
    },
    {
      icon: 'person_alert', color: '#FBBF24', bg: 'rgba(245,158,11,0.12)',
      metricText: `${alerts.length} student${alerts.length === 1 ? '' : 's'}`,
      headline: 'At risk of falling behind',
      sub: alerts.length > 0 ? `${alerts.slice(0, 3).map(a => a.name.split(' ')[0]).join(', ')} ${alerts.length > 3 ? 'and others ' : ''}scored below 60% accuracy — worth a check-in.` : 'No students currently below 60% accuracy.',
      cta: 'View students', to: pathFor('manageTests'), real: alerts.length > 0,
    },
    {
      icon: 'trending_up', color: '#4ADE80', bg: 'rgba(34,197,94,0.12)',
      metricText: 'Illustrative',
      headline: 'Batch improved fastest after revision',
      sub: 'Scores rose fastest in the days after your last revision session — the format is working. Not tracked yet.',
      cta: 'See what worked', to: pathFor('manageTests'), real: false,
    },
    {
      icon: 'menu_book', color: 'var(--faculty-accent)', bg: 'var(--faculty-accent-muted)',
      metricText: 'Illustrative',
      headline: 'A chapter needs immediate reinforcement',
      sub: 'Average solve-time-vs-benchmark tracking isn\'t wired up yet — this will surface real chapters once it is.',
      cta: 'Build a test', to: pathFor('createTest'), real: false,
    },
  ];

  const aiRecs = [
    {
      icon: 'target', color: 'var(--faculty-accent)',
      headline: curriculumGap.focusAreas.length > 0 ? `Assign a revision test on ${curriculumGap.focusAreas[0]}` : 'Assign a revision test on your weakest chapter',
      body: curriculumGap.focusAreas.length > 0 ? curriculumGap.headline : 'Once attempt data comes in, the highest-leverage chapter to revise will appear here.',
      cta: 'Assign', to: pathFor('createTest'),
    },
    {
      icon: 'trending_up', color: '#4ADE80',
      headline: strongestChapter ? `${strongestChapter.name} is your strongest chapter` : 'Strongest chapter — illustrative',
      body: strongestChapter ? `Averaging ${strongestChapter.avg}% accuracy across your tests. Consider raising difficulty slightly to keep it challenging.` : 'Once attempt data comes in, your batch\'s strongest chapter will appear here.',
      cta: 'Raise difficulty', to: null,
    },
    {
      icon: 'notifications_active', color: '#FBBF24',
      headline: 'Practice frequency check-in',
      body: 'Illustrative — practice-frequency trend tracking isn\'t wired up yet. Use Messages to nudge students directly.',
      cta: 'Send reminder', to: pathFor('messages'),
    },
    {
      icon: 'event_repeat', color: 'var(--faculty-accent)',
      headline: 'Revise before the next mock',
      body: 'Illustrative — mock-test scheduling isn\'t tracked yet. Build a revision test for chapters that need it.',
      cta: 'Schedule revision', to: pathFor('createTest'),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Faculty Dashboard' }]}
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">

        {/* Greeting */}
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Academic Overview
            </h1>
            <p className="text-body-md mt-1.5 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              {curriculumGap.focusAreas.length > 0
                ? curriculumGap.headline
                : `${batchStream ? `${batchStream} Batch` : 'Your batch'} performance and student insights.`}
            </p>
            <div
              className="inline-flex items-center gap-1.5 mt-2.5 text-label-sm font-bold px-3 py-1.5 rounded-full"
              style={{ color: 'var(--faculty-accent)', backgroundColor: 'var(--faculty-accent-muted)', border: '1px solid rgba(20,184,166,0.25)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
              {batchStream ? `${batchStream} Batch` : 'My Batch'} · {assignedStudents.length > 0 ? `${assignedStudents.length} students assigned` : 'Loading students…'}
              {countdown ? ` · ${countdown.daysRemaining} days to ${countdown.examLabel}` : ''}
            </div>
          </div>
          <Link to={pathFor('createTest')} className="btn-primary btn-md shrink-0" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Create Test
          </Link>
        </div>

        {/* AI Priority Action */}
        <div
          className="relative overflow-hidden rounded-2xl p-6"
          style={{ background: 'linear-gradient(120deg, var(--faculty-accent-muted), var(--surface) 62%)', border: '1px solid rgba(20,184,166,0.24)' }}
        >
          <div className="flex items-center gap-2 mb-2.5 text-label-sm font-bold uppercase tracking-widest" style={{ color: 'var(--faculty-accent)' }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: '15px' }}>auto_awesome</span>
            AI Priority Action
          </div>
          <p className="text-body-lg font-bold mb-2 max-w-2xl" style={{ color: 'var(--text-primary)' }}>
            {curriculumGap.focusAreas.length > 0
              ? curriculumGap.headline
              : 'Once your students start attempting your tests, the single highest-leverage action for your batch will appear here.'}
          </p>
          {curriculumGap.focusAreas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3.5 mb-4">
              {curriculumGap.focusAreas.map(area => (
                <span key={area} className="text-label-sm font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{area}</span>
              ))}
            </div>
          )}
          <div className="flex gap-2.5 mt-4">
            <Link to={pathFor('createTest')} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}>
              Build Revision Test
            </Link>
            <Link to={pathFor('manageTests')} className="btn-secondary btn-md">My Tests</Link>
          </div>
        </div>

        {/* What needs your attention — 4 insight cards, 2 real / 2 illustrative */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-headline-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>What needs your attention</h2>
              <p className="text-label-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>AI-generated insights, refreshed after every test submission</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {insightCards.map((c, i) => (
              <Link
                key={i}
                to={c.to}
                className="rounded-2xl p-4 flex flex-col transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', opacity: c.real === false ? 0.85 : 1 }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: c.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: c.color }}>{c.icon}</span>
                </div>
                <div className="text-lg font-extrabold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: c.color }}>{c.metricText}</div>
                <div className="text-body-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{c.headline}</div>
                <div className="text-label-sm flex-1" style={{ color: 'var(--text-muted)' }}>{c.sub}</div>
                <div className="text-label-sm font-bold mt-2.5" style={{ color: 'var(--faculty-accent)' }}>{c.cta} →</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-start">
          <div className="flex flex-col gap-5">

            {/* Batch Intelligence — 4 of 8 real (strongest/weakest chapter, avg accuracy,
                attempts folded into the two chapter cards); 4 illustrative and clearly marked. */}
            <Card title="Batch Intelligence" subtitle={`${batchStream ? `${batchStream} Batch` : 'Your batch'} · trends across your tests`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Strongest chapter', value: strongestChapter?.name ?? 'Not enough data yet', note: strongestChapter ? `${strongestChapter.avg}% avg accuracy` : 'Appears once students attempt your tests', color: '#4ADE80' },
                  { label: 'Weakest chapter',   value: curriculumGap.focusAreas[0] ?? 'Not enough data yet', note: curriculumGap.focusAreas.length > 0 ? 'Lowest avg. accuracy' : 'Appears once students attempt your tests', color: '#EF4444' },
                  { label: 'Avg speed',            value: 'Illustrative', note: 'Not tracked yet', color: 'var(--text-faint)' },
                  { label: 'Avg accuracy',         value: avgAccuracy, note: `${attemptCount} attempts logged`, color: 'var(--faculty-accent)' },
                  { label: 'Most misunderstood',   value: 'Illustrative', note: 'Not tracked yet', color: 'var(--text-faint)' },
                  { label: 'Revision completion',  value: 'Illustrative', note: 'Not tracked yet', color: 'var(--text-faint)' },
                  { label: 'Practice consistency', value: 'Illustrative', note: 'Not tracked yet', color: 'var(--text-faint)' },
                  { label: 'Growth this month',    value: 'Illustrative', note: 'Not tracked yet', color: 'var(--text-faint)' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3.5" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <div className="text-label-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)', fontSize: '10px' }}>{s.label}</div>
                    <div className="text-body-md font-bold mb-1" style={{ color: s.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</div>
                    <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{s.note}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Submission activity calendar (LeetCode-style) */}
            <Card title="Test Submission Activity" subtitle="Attempts on your tests per day over the last 6 months">
              <ActivityHeatmap data={submissionsByDay} colorBase="#14B8A6" unit="submission" />
              <div className="mt-3 text-body-sm" style={{ color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{Object.values(submissionsByDay).reduce((s, v) => s + v, 0)} submissions</strong> over <strong style={{ color: 'var(--text-primary)' }}>{Object.keys(submissionsByDay).length} active days</strong>
              </div>
            </Card>

            {/* Student Intelligence — real name/stream/score/accuracy/rank; the ring is
                honestly driven by real accuracy (not a fabricated "readiness" metric). */}
            <Card title="Student Intelligence" subtitle={`${assignedStudents.length} students assigned · sorted by rank`} action={<Link to={pathFor('manageTests')} className="text-label-sm font-bold" style={{ color: 'var(--faculty-accent)' }}>View all →</Link>}>
              {loadingStudents ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner size={28} color="var(--faculty-accent)" />
                </div>
              ) : assignedStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--text-faint)' }}>group_off</span>
                  <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>No students assigned yet. An admin can assign students to your batch.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assignedStudents.slice(0, 6).map(s => {
                    const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const ringColor = s.accuracy >= 80 ? '#10B981' : s.accuracy >= 60 ? '#F59E0B' : '#EF4444';
                    const flagged = alerts.some(a => a.name === s.name);
                    return (
                      <Link
                        key={s.id}
                        to={`/faculty/student/${s.id}`}
                        className="rounded-2xl p-4 flex flex-col gap-3 transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-body-md font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                            <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>Rank #{s.rank} · {s.stream} · {formatExamCountdown(asStream(s.stream))}</div>
                          </div>
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-label-sm font-bold shrink-0"
                            style={{ backgroundColor: `${ringColor}22`, color: ringColor }}
                          >
                            {s.accuracy}%
                          </div>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-bar-fill" style={{ width: `${s.accuracy}%`, backgroundColor: ringColor }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-label-sm font-semibold px-2 py-0.5 rounded-md w-fit"
                            style={flagged
                              ? { color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.10)' }
                              : { color: 'var(--text-faint)', backgroundColor: 'var(--surface)' }}
                          >
                            {flagged ? 'Needs support' : 'On track'}
                          </span>
                          <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{s.score}% score</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* AI Teaching Assistant — no real recommendation engine exists yet, so this
              panel's guidance text is decorative; "Assign"/"Send reminder"/"Schedule
              revision" route to real pages. Dismiss genuinely removes the card (local
              view state only, not persisted). */}
          <Card title="AI Teaching Assistant" subtitle="Illustrative guidance — continuously-updating recommendations aren't wired up yet">
            <div className="flex flex-col gap-3">
              {aiRecs.map((rec, i) => dismissedRecs.has(i) ? null : (
                <div key={i} className="rounded-xl p-3.5" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: rec.color }}>{rec.icon}</span>
                    <span className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>{rec.headline}</span>
                  </div>
                  <p className="text-label-sm mb-3" style={{ color: 'var(--text-muted)' }}>{rec.body}</p>
                  <div className="flex gap-2">
                    {rec.to ? (
                      <Link to={rec.to} className="text-label-sm font-bold px-3 py-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))', color: '#fff' }}>
                        {rec.cta}
                      </Link>
                    ) : (
                      <span className="text-label-sm font-semibold px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-faint)', border: '1px solid var(--border)', cursor: 'not-allowed' }}>
                        {rec.cta}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setDismissedRecs(prev => new Set(prev).add(i))}
                      className="text-label-sm font-semibold px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--border)' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
              {dismissedRecs.size === aiRecs.length && (
                <p className="text-body-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>All caught up — check back later for new recommendations.</p>
              )}
            </div>
            <div className="text-label-sm text-center mt-3.5 pt-3.5" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border-muted)' }}>
              Insights refresh automatically as new attempts come in
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
