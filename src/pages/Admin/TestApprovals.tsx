import { useEffect, useState } from 'react';
import { getPendingApprovalTests, updateTestStatus, type Test } from '../../lib/tests';
import { useToast } from '../../components/Toast';

export default function TestApprovals() {
  const toast = useToast();

  const [tests, setTests]         = useState<Test[]>([]);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  useEffect(() => {
    getPendingApprovalTests()
      .then(setTests)
      .finally(() => setLoading(false));
  }, []);

  async function approve(testId: string) {
    setActing(testId);
    try {
      await updateTestStatus(testId, 'approved');
      setTests(p => p.filter(t => t.id !== testId));
      toast('Test approved and published to students', 'success');
    } catch {
      toast('Failed to approve test', 'error');
    } finally {
      setActing(null);
    }
  }

  async function reject(testId: string) {
    if (!rejectNote.trim()) { toast('Please enter a rejection reason', 'error'); return; }
    setActing(testId);
    try {
      await updateTestStatus(testId, 'rejected', rejectNote.trim());
      setTests(p => p.filter(t => t.id !== testId));
      setRejectTarget(null);
      setRejectNote('');
      toast('Test rejected with note sent to faculty', 'success');
    } catch {
      toast('Failed to reject test', 'error');
    } finally {
      setActing(null);
    }
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-56 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Test Approvals
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Review and approve coaching tests submitted by faculty
        </p>
      </div>

      {tests.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
          <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--text-faint)' }}>verified</span>
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>All caught up!</p>
          <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>No tests pending approval</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <div
              key={test.id}
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
            >
              {/* Header stripe */}
              <div className="h-1" style={{ background: 'linear-gradient(90deg, #5B4FE8, #7C3AED)' }} />

              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.10)', color: '#B45309' }}>
                        Pending Review
                      </span>
                      <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }}>
                        Coaching
                      </span>
                    </div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{test.title}</h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {test.subjects.join(', ')} · {test.difficulty}
                    </p>
                  </div>
                  <p className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>
                    {test.createdAt ? new Date(test.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { icon: 'quiz', label: 'Questions', val: test.questionCount },
                    { icon: 'timer', label: 'Duration', val: formatDuration(test.durationSeconds) },
                    { icon: 'library_books', label: 'Chapters', val: test.chapters.length },
                  ].map(({ icon, label, val }) => (
                    <div key={label} className="rounded-xl p-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
                      <span className="material-symbols-outlined block mb-1" style={{ fontSize: 18, color: '#5B4FE8' }}>{icon}</span>
                      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{val}</div>
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Chapters list */}
                {test.chapters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {test.chapters.map(ch => (
                      <span key={ch} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {ch}
                      </span>
                    ))}
                  </div>
                )}

                {test.instructions && (
                  <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(91,79,232,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {test.instructions}
                  </p>
                )}

                {/* Reject modal inline */}
                {rejectTarget === test.id && (
                  <div className="space-y-2">
                    <textarea
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      rows={3}
                      placeholder="Reason for rejection (required)…"
                      autoFocus
                      className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                      style={{ backgroundColor: 'var(--surface-muted)', border: '1.5px solid #EF4444', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setRejectTarget(null); setRejectNote(''); }} className="btn-ghost btn-sm flex-1">
                        Cancel
                      </button>
                      <button type="button" onClick={() => reject(test.id)} disabled={acting === test.id || !rejectNote.trim()}
                        className="btn-sm flex-1"
                        style={{ backgroundColor: '#EF4444', color: '#fff', border: 'none', borderRadius: 10 }}>
                        {acting === test.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirm Reject'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {rejectTarget !== test.id && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setRejectTarget(test.id); setRejectNote(''); }}
                      className="btn-outline btn-md flex-1 justify-center"
                      style={{ borderColor: '#EF4444', color: '#EF4444' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(test.id)}
                      disabled={acting === test.id}
                      className="btn-primary btn-md flex-1 justify-center"
                      style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                    >
                      {acting === test.id ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                      )}
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
