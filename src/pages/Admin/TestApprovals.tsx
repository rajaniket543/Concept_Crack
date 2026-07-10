import { useEffect, useState } from 'react';
import { getPendingApprovalTests, forwardForVerification, finalizeApproval, type Test } from '../../lib/tests';
import { listFaculty, notify } from '../../lib/db';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

const DESIGNATIONS = ['HOD', 'Senior Faculty', 'Subject Expert'];

export default function TestApprovals() {
  const toast = useToast();
  const confirm = useConfirm();

  const [tests, setTests]         = useState<Test[]>([]);
  const [faculty, setFaculty]     = useState<Array<{ id: string; name: string; designation?: string }>>([]);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState<string | null>(null);

  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const [forwardTarget, setForwardTarget] = useState<string | null>(null);
  const [verifierId, setVerifierId] = useState('');
  const [designation, setDesignation] = useState(DESIGNATIONS[0]);

  useEffect(() => {
    Promise.all([getPendingApprovalTests(), listFaculty()])
      .then(([t, f]) => { setTests(t); setFaculty(f); })
      .finally(() => setLoading(false));
  }, []);

  async function approve(test: Test) {
    const ok = await confirm({
      title: 'Approve and publish this test?',
      message: `"${test.title}" will go live and become available to students immediately.`,
      confirmLabel: 'Approve & publish',
      tone: 'success',
      icon: 'verified',
    });
    if (!ok) return;
    setActing(test.id);
    try {
      await finalizeApproval(test.id, 'approved');
      setTests(p => p.filter(t => t.id !== test.id));
      if (test.createdBy) void notify(test.createdBy, 'Test approved', `Your coaching test "${test.title}" was approved and is now live for students.`, 'approval');
      toast('Test approved and published to students', 'success');
    } catch { toast('Failed to approve test', 'error'); }
    finally { setActing(null); }
  }

  async function reject(test: Test) {
    if (!rejectNote.trim()) { toast('Please enter a rejection reason', 'error'); return; }
    setActing(test.id);
    try {
      await finalizeApproval(test.id, 'final_rejected', rejectNote.trim());
      setTests(p => p.filter(t => t.id !== test.id));
      if (test.createdBy) void notify(test.createdBy, 'Test rejected', `Your coaching test "${test.title}" was rejected: ${rejectNote.trim()}`, 'approval');
      setRejectTarget(null);
      setRejectNote('');
      toast('Test finally rejected — faculty must create a fresh test', 'success');
    } catch { toast('Failed to reject test', 'error'); }
    finally { setActing(null); }
  }

  async function forward(test: Test) {
    if (!verifierId) { toast('Choose a verifier', 'error'); return; }
    const v = faculty.find(f => f.id === verifierId);
    if (!v) { toast('Verifier not found', 'error'); return; }
    setActing(test.id);
    try {
      await forwardForVerification(test.id, { id: v.id, name: v.name, designation });
      setTests(p => p.map(t => t.id === test.id
        ? { ...t, verification: { stage: 'awaiting', verifierId: v.id, verifierName: v.name, verifierDesignation: designation } }
        : t));
      void notify(v.id, 'Test to review', `You've been asked to review "${test.title}" as ${designation}. Open Verifications to approve or reject it.`, 'approval');
      setForwardTarget(null);
      setVerifierId('');
      toast(`Forwarded to ${v.name} (${designation}) for verification`, 'success');
    } catch { toast('Failed to forward test', 'error'); }
    finally { setActing(null); }
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-56 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Test Approvals</h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Approve coaching tests directly, or forward them to an HOD / senior faculty / subject expert for verification first.
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
          {tests.map(test => {
            const v = test.verification;
            const stage = v?.stage ?? 'none';
            return (
              <div key={test.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="h-1" style={{ background: 'linear-gradient(90deg, #5B4FE8, #7C3AED)' }} />
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.10)', color: '#B45309' }}>Pending Review</span>
                        <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }}>Coaching</span>
                        {stage === 'awaiting'  && <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59,130,246,0.10)', color: '#2563EB' }}>Awaiting verification</span>}
                        {stage === 'verified'  && <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }}>Verified</span>}
                        {stage === 'rejected'  && <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>Verifier rejected</span>}
                      </div>
                      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{test.title}</h3>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{test.subjects.join(', ')} · {test.difficulty}</p>
                    </div>
                    <p className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>
                      {test.createdAt ? new Date(test.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>

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

                  {/* Verification result banner */}
                  {v && stage !== 'none' && (
                    <div className="rounded-xl p-3.5" style={{
                      backgroundColor: stage === 'verified' ? 'rgba(16,185,129,0.06)' : stage === 'rejected' ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)',
                      border: `1px solid ${stage === 'verified' ? 'rgba(16,185,129,0.25)' : stage === 'rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}`,
                    }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: stage === 'verified' ? '#059669' : stage === 'rejected' ? '#DC2626' : '#2563EB' }}>
                          {stage === 'verified' ? 'verified_user' : stage === 'rejected' ? 'gpp_bad' : 'hourglass_top'}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {stage === 'awaiting'
                            ? `Awaiting verification by ${v.verifierName} (${v.verifierDesignation})`
                            : `${stage === 'verified' ? 'Verified' : 'Rejected'} by ${v.verifierName} (${v.verifierDesignation})`}
                        </span>
                      </div>
                      {v.decidedAt && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Decision date: {new Date(v.decidedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
                      {v.remarks && <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>“{v.remarks}”</div>}
                    </div>
                  )}

                  {test.instructions && (
                    <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(91,79,232,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{test.instructions}</p>
                  )}

                  {/* Reject panel */}
                  {rejectTarget === test.id ? (
                    <div className="space-y-2">
                      <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Reason for final rejection (required)…" autoFocus
                        className="w-full rounded-xl px-4 py-3 text-sm resize-none" style={{ backgroundColor: 'var(--surface-muted)', border: '1.5px solid #EF4444', color: 'var(--text-primary)', outline: 'none' }} />
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Final rejection is permanent — the faculty must create a brand-new test.</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setRejectTarget(null); setRejectNote(''); }} className="btn-ghost btn-sm flex-1">Cancel</button>
                        <button type="button" onClick={() => reject(test)} disabled={acting === test.id || !rejectNote.trim()} className="btn-sm flex-1" style={{ backgroundColor: '#EF4444', color: '#fff', border: 'none', borderRadius: 10 }}>
                          {acting === test.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirm Final Reject'}
                        </button>
                      </div>
                    </div>
                  ) : forwardTarget === test.id ? (
                    /* Forward panel */
                    <div className="space-y-2 rounded-xl p-3" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Forward for verification</div>
                      {faculty.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No faculty available to verify.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select value={verifierId} onChange={e => setVerifierId(e.target.value)} className="input-field w-full" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                            <option value="">Choose verifier…</option>
                            {faculty.map(f => <option key={f.id} value={f.id}>{f.name}{f.designation ? ` · ${f.designation}` : ''}</option>)}
                          </select>
                          <select value={designation} onChange={e => setDesignation(e.target.value)} className="input-field w-full" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                            {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setForwardTarget(null); setVerifierId(''); }} className="btn-ghost btn-sm flex-1">Cancel</button>
                        <button type="button" onClick={() => forward(test)} disabled={acting === test.id || !verifierId} className="btn-primary btn-sm flex-1 justify-center" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                          {acting === test.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Send for Verification'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Action buttons */
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => { setRejectTarget(test.id); setRejectNote(''); }} className="btn-outline btn-md flex-1 justify-center min-w-[120px]" style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span> Reject
                      </button>
                      {stage === 'none' && (
                        <button type="button" onClick={() => { setForwardTarget(test.id); setVerifierId(''); }} className="btn-outline btn-md flex-1 justify-center min-w-[120px]">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>forward_to_inbox</span> Forward
                        </button>
                      )}
                      <button type="button" onClick={() => approve(test)} disabled={acting === test.id} className="btn-primary btn-md flex-1 justify-center min-w-[120px]" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                        {acting === test.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>}
                        {stage === 'none' ? 'Approve Directly' : 'Approve'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
