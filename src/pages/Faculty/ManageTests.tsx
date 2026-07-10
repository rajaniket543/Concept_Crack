import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getFacultyTests, updateTestStatus, type Test } from '../../lib/tests';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

// Status filters (3f)
const FILTERS = ['All', 'Active', 'Pending', 'Approved', 'Rejected', 'Closed', 'Draft'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_STATUSES: Record<Filter, string[]> = {
  All:      [],
  Active:   ['active'],
  Pending:  ['pending_approval'],
  Approved: ['approved'],
  Rejected: ['rejected', 'final_rejected'],
  Closed:   ['closed'],
  Draft:    ['draft'],
};

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft:            { label: 'Draft',            bg: 'rgba(107,114,128,0.10)', color: '#6B7280' },
  pending_approval: { label: 'Pending Approval', bg: 'rgba(245,158,11,0.10)',  color: '#B45309' },
  approved:         { label: 'Approved',         bg: 'rgba(91,79,232,0.10)',   color: '#5B4FE8' },
  rejected:         { label: 'Rejected',         bg: 'rgba(239,68,68,0.10)',   color: '#EF4444' },
  final_rejected:   { label: 'Final Rejected',   bg: 'rgba(239,68,68,0.14)',   color: '#DC2626' },
  active:           { label: 'Active',           bg: 'rgba(16,185,129,0.10)',  color: '#059669' },
  closed:           { label: 'Closed',           bg: 'rgba(107,114,128,0.10)', color: '#6B7280' },
};

const VERIFY_META: Record<string, { label: string; bg: string; color: string }> = {
  awaiting: { label: 'Awaiting verification', bg: 'rgba(59,130,246,0.10)', color: '#2563EB' },
  verified: { label: 'Verified',              bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  rejected: { label: 'Verifier rejected',     bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
};

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export default function ManageTests() {
  const navigate = useNavigate();
  const toast    = useToast();
  const confirm  = useConfirm();
  const uid      = getAuthSession()?.user?.id ?? '';

  const [tests, setTests]     = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);
  const [filter, setFilter]   = useState<Filter>('All');

  useEffect(() => {
    if (!uid) return;
    getFacultyTests(uid)
      .then(setTests)
      .finally(() => setLoading(false));
  }, [uid]);

  const filteredTests = useMemo(() => {
    const statuses = FILTER_STATUSES[filter];
    return statuses.length === 0 ? tests : tests.filter(t => statuses.includes(t.status));
  }, [tests, filter]);

  const countFor = (f: Filter) => {
    const statuses = FILTER_STATUSES[f];
    return statuses.length === 0 ? tests.length : tests.filter(t => statuses.includes(t.status)).length;
  };

  async function closeTest(testId: string) {
    const ok = await confirm({
      title: 'Close this test?',
      message: 'Students will no longer be able to access or attempt it. This cannot be undone.',
      confirmLabel: 'Close test',
      tone: 'danger',
      icon: 'block',
    });
    if (!ok) return;
    setClosing(testId);
    try {
      await updateTestStatus(testId, 'closed');
      setTests(prev => prev.map(t => t.id === testId ? { ...t, status: 'closed' } : t));
      toast('Test closed', 'success');
    } catch {
      toast('Failed to close test', 'error');
    } finally {
      setClosing(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            My Tests
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            {tests.length} test{tests.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(pathFor('createTest'))}
          className="btn-primary btn-md"
          style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Create Test
        </button>
      </div>

      {/* Status filters (3f) */}
      {tests.length > 0 && (
        <div className="tab-pills flex-wrap">
          {FILTERS.map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`tab-pill ${filter === f ? 'active' : ''}`}>
              {f} ({countFor(f)})
            </button>
          ))}
        </div>
      )}

      {tests.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
          <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--text-faint)' }}>quiz</span>
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>No tests yet</p>
          <button
            type="button"
            onClick={() => navigate(pathFor('createTest'))}
            className="btn-primary btn-md mt-4 mx-auto"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            Create your first test
          </button>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
          <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>No {filter.toLowerCase()} tests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTests.map(test => {
            const sm = STATUS_META[test.status] ?? STATUS_META.draft;
            return (
              <div
                key={test.id}
                className="rounded-2xl p-5"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: sm.bg, color: sm.color }}>
                        {sm.label}
                      </span>
                      <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }}>
                        {test.type === 'faculty_batch' ? 'Batch' : 'Coaching'}
                      </span>
                      {test.verification && test.verification.stage !== 'none' && test.status === 'pending_approval' && VERIFY_META[test.verification.stage] && (
                        <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: VERIFY_META[test.verification.stage].bg, color: VERIFY_META[test.verification.stage].color }}>
                          {VERIFY_META[test.verification.stage].label}
                          {test.verification.verifierName ? ` · ${test.verification.verifierName}` : ''}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{test.title}</h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {test.subjects.join(', ')} · {test.chapters.length} chapter{test.chapters.length !== 1 ? 's' : ''} · {test.difficulty}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(test.status === 'active' || test.status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => closeTest(test.id)}
                        disabled={closing === test.id}
                        className="btn-ghost btn-sm"
                        style={{ color: '#EF4444' }}
                      >
                        {closing === test.id ? (
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                        )}
                        Close
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>quiz</span>
                    {test.questionCount}q
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>timer</span>
                    {formatDuration(test.durationSeconds)}
                  </span>
                  {test.endAt && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                      Ends {new Date(test.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {(test.status === 'rejected' || test.status === 'final_rejected') && test.rejectionNote && (
                    <span className="flex items-center gap-1" style={{ color: '#EF4444' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                      {test.rejectionNote}
                    </span>
                  )}
                </div>
                {test.status === 'final_rejected' && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#DC2626' }}>block</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      This submission is finally rejected and can't be edited. Create a fresh test to restart the approval workflow.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
