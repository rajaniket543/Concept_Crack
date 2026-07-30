import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import MathText from '../../components/MathText';
import { getAuthSession } from '../../lib/auth';
import { pathFor } from '../../lib/pages';
import { getOrCreateDailyChallengeTest, getAttemptForDailyChallenge, isPastChallenge } from '../../lib/dailyChallenge';
import { getQuestionsByIds, type ExamQuestion } from '../../lib/questions';
import type { TestAttempt } from '../../lib/tests';
import type { StudentStream } from '../../lib/stream';
import { STREAM_COLORS, STREAM_BG } from '../../lib/stream';

// Read-only review of a past day's daily challenge. Deliberately a separate,
// simple page rather than a "readOnly" flag threaded through ExamInterface —
// none of that page's timer / anti-cheat / autosave / submit machinery should
// ever be live when you're just looking at what a previous day's paper was.

export default function DailyChallengeReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const uid = getAuthSession()?.user?.id;

  const { date, stream } = (location.state ?? {}) as { date?: string; stream?: StudentStream };

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only past days are reviewable — today's challenge is taken live, and
    // future days don't exist yet.
    if (!date || !stream || !uid || !isPastChallenge(date)) {
      navigate(pathFor('student'), { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const challenge = await getOrCreateDailyChallengeTest(uid, stream, date);
        const [qs, att] = await Promise.all([
          getQuestionsByIds(challenge.questionIds),
          getAttemptForDailyChallenge(uid, challenge.id),
        ]);
        if (cancelled) return;
        setQuestions(qs);
        setAttempt(att);
      } catch (e) {
        console.error('Failed to load challenge review:', e);
        if (!cancelled) setError("Couldn't load that day's challenge.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, stream, uid]);

  const prettyDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Dashboard', href: pathFor('student') }, { label: 'Challenge Review' }]} />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                Challenge Review
              </h1>
              <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>{prettyDate}</p>
            </div>
            <Link to={pathFor('student')} className="btn-outline btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Back to Dashboard
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
              {error}
            </div>
          ) : (
            <>
              {/* Real result summary, or an honest "not attempted" banner */}
              {attempt ? (
                <div className="rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {[
                    { label: 'Score',    value: String(attempt.score),            color: 'var(--brand)' },
                    { label: 'Accuracy', value: `${attempt.accuracyPct}%`,         color: '#10B981' },
                    { label: 'Correct',  value: `${attempt.correctCount}/${questions.length}`, color: '#059669' },
                    { label: 'Time',     value: `${Math.round(attempt.timeSeconds / 60)}m`,    color: '#F59E0B' },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="text-xl font-bold font-headline" style={{ color: s.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</div>
                      <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  You didn't attempt this challenge. Here are the questions and their correct answers.
                </div>
              )}

              {/* Questions — fully inert, correct answer always shown */}
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const subject = q.subject ?? '';
                  const color = STREAM_COLORS[subject] ?? 'var(--brand)';
                  const bg = STREAM_BG[subject] ?? 'var(--brand-muted)';
                  const myAnswer = attempt?.answers?.[q.id];
                  return (
                    <div key={q.id} className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: color }}>
                          {i + 1}
                        </span>
                        {subject && (
                          <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>{subject}</span>
                        )}
                        {q.chapter && (
                          <span className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{q.chapter}</span>
                        )}
                        {myAnswer && (
                          <span
                            className="text-label-sm font-bold px-2 py-0.5 rounded-full ml-auto"
                            style={myAnswer === q.answer
                              ? { backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }
                              : { backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }}
                          >
                            {myAnswer === q.answer ? 'You got this right' : 'You got this wrong'}
                          </span>
                        )}
                        {attempt && !myAnswer && (
                          <span className="text-label-sm font-bold px-2 py-0.5 rounded-full ml-auto" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-faint)' }}>
                            Skipped
                          </span>
                        )}
                      </div>

                      {q.imageUrl && <img src={q.imageUrl} alt="Question figure" className="rounded-lg max-h-64 mb-3 mx-auto" />}
                      <div className="text-body-md mb-4" style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>
                        <MathText text={q.prompt} />
                      </div>

                      <div className="space-y-2">
                        {q.options.map(o => {
                          const isCorrect = o.key === q.answer;
                          const isMine = o.key === myAnswer;
                          const style = isCorrect
                            ? { backgroundColor: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.40)' }
                            : isMine
                              ? { backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)' }
                              : { backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' };
                          return (
                            <div key={o.key} className="rounded-lg px-3 py-2.5 flex items-start gap-2.5 text-sm" style={style}>
                              <span className="font-bold shrink-0" style={{ color: isCorrect ? '#059669' : isMine ? '#DC2626' : 'var(--text-muted)' }}>
                                {o.key}.
                              </span>
                              <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                                {o.imageUrl ? <img src={o.imageUrl} alt={`Option ${o.key}`} className="max-h-24" /> : <MathText text={o.text} />}
                              </span>
                              {isCorrect && (
                                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 17, color: '#059669' }}>check_circle</span>
                              )}
                              {isMine && !isCorrect && (
                                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 17, color: '#DC2626' }}>cancel</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="mt-3 rounded-lg p-3 text-body-sm" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                          <span className="font-semibold">Explanation: </span>
                          <MathText text={q.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
