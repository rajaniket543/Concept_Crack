import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthSession } from '../lib/auth';
import { pathFor } from '../lib/pages';
import { getStudentAttempts, ATTEMPT_TYPE_META, type TestAttempt } from '../lib/tests';

// Recent attempt history — the last few things the student actually submitted,
// with the real score/accuracy each one earned. Every value comes straight off
// the stored attempt; nothing here is estimated.

const SHOWN = 5;

function accuracyColor(pct: number): string {
  return pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
}

function relativeDay(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function RecentTestsCard() {
  const uid = getAuthSession()?.user?.id;

  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    // getStudentAttempts deliberately throws rather than returning [] on a read
    // failure, so an empty list never gets mistaken for "no history".
    getStudentAttempts(uid)
      .then(list => { if (!cancelled) setAttempts(list.slice(0, SHOWN)); })
      .catch(e => {
        console.error('Recent tests failed to load:', e);
        if (!cancelled) setError("Couldn't load your recent tests.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, retryTick]);

  return (
    <div className="rounded-2xl p-5 h-full flex flex-col" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-title-md font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Recent Tests
          </h3>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Your latest submitted attempts
          </p>
        </div>
        <Link to={pathFor('testLog')} className="btn-outline btn-sm shrink-0">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl p-4 flex-wrap" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <span className="text-body-sm" style={{ color: '#EF4444' }}>{error}</span>
          <button
            type="button"
            onClick={() => setRetryTick(t => t + 1)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-semibold shrink-0"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.30)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span> Retry
          </button>
        </div>
      ) : attempts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <span className="material-symbols-outlined mb-2" style={{ fontSize: 34, color: 'var(--text-faint)' }}>quiz</span>
          <p className="text-body-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No attempts yet</p>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Finish a test or practice set and it'll show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attempts.map(a => {
            const meta = ATTEMPT_TYPE_META[a.testType ?? 'practice'] ?? ATTEMPT_TYPE_META.practice;
            const answered = (a.correctCount ?? 0) + (a.incorrectCount ?? 0);
            return (
              <Link
                key={a.id}
                to={pathFor('testLog')}
                className="flex items-center gap-3 rounded-xl p-3 transition-all hover:-translate-y-px"
                style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: meta.color }}>{meta.icon}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-body-md font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {a.testTitle || meta.label}
                  </div>
                  <div className="text-label-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {meta.label} · {a.correctCount ?? 0}/{answered || '—'} correct · {relativeDay(a.submittedAt)}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-body-md font-bold" style={{ color: accuracyColor(a.accuracyPct ?? 0) }}>
                    {a.accuracyPct ?? 0}%
                  </div>
                  <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>{a.score ?? 0} pts</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
