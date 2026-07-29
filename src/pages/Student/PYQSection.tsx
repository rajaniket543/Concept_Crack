import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getPYQTests, hasAttempted, type Test } from '../../lib/tests';
import { pathFor } from '../../lib/pages';

interface PaperCard {
  test: Test;
  attempted: boolean;
}

export default function PYQSection() {
  const navigate = useNavigate();
  const uid    = getAuthSession()?.user?.id ?? '';
  const stream = getStudentStream() ?? undefined;

  const [loading, setLoading] = useState(true);
  const [papers, setPapers]   = useState<PaperCard[]>([]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getPYQTests(stream)
      .then(tests => Promise.all(tests.map(async t => ({ test: t, attempted: await hasAttempted(t.id, uid) }))))
      .then(setPapers)
      .finally(() => setLoading(false));
  }, [uid]);

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  function startPaper(t: Test) {
    navigate(pathFor('exam'), { state: { testId: t.id, examTitle: t.title } });
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 h-56 animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Previous Year Papers
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Full JEE Main papers, exactly as they appeared — every question in original order across Physics, Chemistry and Mathematics.
        </p>
      </div>

      {papers.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
          <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--text-faint)' }}>history_edu</span>
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>No papers available yet</p>
          <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>Check back soon</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {papers.map(({ test, attempted }) => (
            <div
              key={test.id}
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(180,83,9,0.10)', color: '#B45309' }}>
                    PYQ
                  </span>
                  <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(107,114,128,0.08)', color: 'var(--text-muted)' }}>
                    {test.subjects.join(' · ')}
                  </span>
                </div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{test.title}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: 'quiz', label: 'Questions', val: test.questionCount },
                  { icon: 'timer', label: 'Duration', val: formatDuration(test.durationSeconds) },
                ].map(({ icon, label, val }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--surface-muted)' }}>
                    <span className="material-symbols-outlined block mb-1" style={{ fontSize: 18, color: 'var(--brand)' }}>{icon}</span>
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{val}</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{label}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => startPaper(test)}
                disabled={attempted}
                className="btn-primary btn-md w-full justify-center"
                style={attempted ? { opacity: 0.5, cursor: 'not-allowed', background: 'var(--surface-muted)' } : { background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {attempted ? 'check_circle' : 'play_arrow'}
                </span>
                {attempted ? 'Already Attempted' : 'Start Paper'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
