import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getAssignedTests, getCoachingTests, hasAttempted, type Test } from '../../lib/tests';
import { pathFor } from '../../lib/pages';

interface TestCard {
  test: Test;
  attempted: boolean;
}

export default function AssignedTests() {
  const navigate = useNavigate();
  const uid    = getAuthSession()?.user?.id ?? '';
  const stream = getStudentStream() ?? undefined;

  const [loading, setLoading]   = useState(true);
  const [cards, setCards]       = useState<TestCard[]>([]);
  const [coaching, setCoaching] = useState<TestCard[]>([]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    Promise.all([
      getAssignedTests(uid, stream),
      getCoachingTests(stream),
    ]).then(async ([batch, coach]) => {
      const withAttempt = async (tests: Test[]) =>
        Promise.all(tests.map(async t => ({ test: t, attempted: await hasAttempted(t.id, uid) })));
      const [b, c] = await Promise.all([withAttempt(batch), withAttempt(coach)]);
      setCards(b);
      setCoaching(c);
    }).finally(() => setLoading(false));
  }, [uid]);

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  function statusColor(t: Test) {
    if (t.status === 'active')   return { bg: 'rgba(16,185,129,0.10)', text: '#059669' };
    if (t.status === 'approved') return { bg: 'rgba(91,79,232,0.10)',  text: '#5B4FE8' };
    return                                { bg: 'rgba(107,114,128,0.10)', text: '#6B7280' };
  }

  function startTest(t: Test) {
    navigate(pathFor('exam'), { state: { testId: t.id, examTitle: t.title } });
  }

  function renderCard(card: TestCard, badge: string) {
    const { test, attempted } = card;
    const sc = statusColor(test);
    return (
      <div
        key={test.id}
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                {test.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(107,114,128,0.08)', color: 'var(--text-muted)' }}>
                {badge}
              </span>
            </div>
            <h3 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{test.title}</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {test.subjects.join(', ')} · {test.chapters.length} chapter{test.chapters.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: 'quiz', label: 'Questions', val: test.questionCount },
            { icon: 'timer', label: 'Duration', val: formatDuration(test.durationSeconds) },
            { icon: 'trending_up', label: 'Difficulty', val: test.difficulty },
          ].map(({ icon, label, val }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--surface-muted)' }}>
              <span className="material-symbols-outlined block mb-1" style={{ fontSize: 18, color: '#5B4FE8' }}>{icon}</span>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{val}</div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{label}</div>
            </div>
          ))}
        </div>

        {test.endAt && (
          <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
            Ends {new Date(test.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {test.instructions && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(91,79,232,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(91,79,232,0.12)' }}>
            {test.instructions}
          </p>
        )}

        <button
          type="button"
          onClick={() => startTest(test)}
          disabled={attempted}
          className="btn-primary btn-md w-full justify-center"
          style={attempted ? { opacity: 0.5, cursor: 'not-allowed', background: 'var(--surface-muted)' } : { background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {attempted ? 'check_circle' : 'play_arrow'}
          </span>
          {attempted ? 'Already Attempted' : 'Start Test'}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 h-64 animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
          ))}
        </div>
      </div>
    );
  }

  const all = [...cards, ...coaching];

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Assigned Tests
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Faculty-assigned and coaching tests available to you
        </p>
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
          <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--text-faint)' }}>assignment</span>
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>No tests assigned yet</p>
          <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your faculty will assign tests here</p>
        </div>
      ) : (
        <>
          {cards.length > 0 && (
            <section>
              <h2 className="text-label-lg font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-faint)' }}>
                Batch Tests
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map(c => renderCard(c, 'Batch'))}
              </div>
            </section>
          )}
          {coaching.length > 0 && (
            <section>
              <h2 className="text-label-lg font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-faint)' }}>
                Coaching Tests
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coaching.map(c => renderCard(c, 'Coaching'))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
