import { useEffect, useState } from 'react';
import { getAuthSession } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { getVerificationQueue, submitVerification, type Test } from '../../lib/tests';
import { getQuestionsByIds, type ExamQuestion } from '../../lib/questions';
import { notifyRole } from '../../lib/db';
import MathText from '../../components/MathText';
import { Link } from 'react-router-dom';
import { pathFor } from '../../lib/pages';

const REVIEW_POINTS = ['Questions', 'Difficulty', 'Errors', 'Syllabus coverage', 'Quality', 'Solutions'];

export default function TestVerification() {
  const toast   = useToast();
  const confirm = useConfirm();
  const session = getAuthSession();
  const uid     = session?.user?.id ?? '';
  const uname   = session?.user?.name ?? 'Faculty';

  const [tests, setTests]     = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, ExamQuestion[]>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!uid) return;
    getVerificationQueue(uid).then(setTests).finally(() => setLoading(false));
  }, [uid]);

  async function toggleQuestions(test: Test) {
    if (expanded === test.id) { setExpanded(null); return; }
    setExpanded(test.id);
    if (!questions[test.id]) {
      try {
        const qs = await getQuestionsByIds(test.questionIds);
        setQuestions(prev => ({ ...prev, [test.id]: qs }));
      } catch { toast('Could not load questions', 'error'); }
    }
  }

  async function decide(test: Test, decision: 'verified' | 'rejected') {
    const note = (remarks[test.id] ?? '').trim();
    if (decision === 'rejected' && !note) { toast('Please add remarks explaining the rejection', 'error'); return; }
    const ok = await confirm({
      title: decision === 'verified' ? 'Verify this test?' : 'Reject this test?',
      message: decision === 'verified'
        ? `"${test.title}" will be sent back to the admin as verified, with your remarks.`
        : `"${test.title}" will be sent back to the admin as rejected, with your remarks.`,
      confirmLabel: decision === 'verified' ? 'Verify' : 'Reject',
      tone: decision === 'verified' ? 'success' : 'danger',
      icon: decision === 'verified' ? 'verified' : 'close',
    });
    if (!ok) return;
    setActing(test.id);
    try {
      await submitVerification(test.id, decision, note, { id: uid, name: uname });
      setTests(p => p.filter(t => t.id !== test.id));
      void notifyRole('admin', `Review ${decision}`, `${uname} ${decision} "${test.title}". It's back in Test Approvals for your final decision.`, 'approval');
      toast(decision === 'verified' ? 'Verified and sent back to admin' : 'Rejected and sent back to admin', 'success');
    } catch { toast('Failed to submit your decision', 'error'); }
    finally { setActing(null); }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-56 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Verifications</h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Tests an admin has forwarded to you. Review, then approve or reject with remarks — it returns to the admin for the final decision.
        </p>
      </div>

      {/* Student-reported question issues now live on their own page, with
          filters, full review detail and an edit-history audit trail. */}
      <Link
        to={pathFor('reportedQuestions')}
        className="rounded-2xl p-4 flex items-center gap-3 transition-all hover:-translate-y-px"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#DC2626' }}>flag</span>
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reported Questions</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Review questions students have flagged as wrong or unclear</div>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-faint)' }}>arrow_forward</span>
      </Link>

      {tests.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
          <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--text-faint)' }}>fact_check</span>
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>Nothing to verify</p>
          <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>You have no tests awaiting your verification.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => {
            const qs = questions[test.id];
            return (
              <div key={test.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="h-1" style={{ background: 'linear-gradient(90deg, #3B82F6, #2563EB)' }} />
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59,130,246,0.10)', color: '#2563EB' }}>
                          To verify · {test.verification?.verifierDesignation}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{test.title}</h3>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {test.subjects.join(', ')} · {test.difficulty} · {test.questionCount} questions
                      </p>
                    </div>
                    <button type="button" onClick={() => toggleQuestions(test)} className="btn-outline btn-sm shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{expanded === test.id ? 'expand_less' : 'expand_more'}</span>
                      {expanded === test.id ? 'Hide' : 'Review'} questions
                    </button>
                  </div>

                  {/* Review checklist */}
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_POINTS.map(p => (
                      <span key={p} className="text-label-sm px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{p}</span>
                    ))}
                  </div>

                  {/* Questions */}
                  {expanded === test.id && (
                    <div className="space-y-2 max-h-96 overflow-y-auto rounded-xl p-3" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                      {!qs ? (
                        <div className="flex items-center gap-2 text-sm py-2" style={{ color: 'var(--text-muted)' }}>
                          <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} /> Loading questions…
                        </div>
                      ) : qs.length === 0 ? (
                        <p className="text-sm py-2" style={{ color: 'var(--text-faint)' }}>No questions found for this test.</p>
                      ) : qs.map((q, i) => (
                        <div key={q.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                          {q.imageUrl && (
                            <img src={q.imageUrl} alt="Question figure" className="rounded-lg max-h-40 mb-2" style={{ border: '1px solid var(--border)' }} />
                          )}
                          <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>{i + 1}. <MathText text={q.prompt} /></p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {q.options.map(o => (
                              <div key={o.key} className="text-xs flex items-center gap-1.5" style={{ color: q.answer === o.key ? '#059669' : 'var(--text-muted)' }}>
                                <span className="font-bold">{o.key}.</span> <MathText text={o.text} />
                                {q.answer === o.key && <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Remarks + decision */}
                  <textarea
                    value={remarks[test.id] ?? ''}
                    onChange={e => setRemarks(prev => ({ ...prev, [test.id]: e.target.value }))}
                    rows={2}
                    placeholder="Remarks (required if rejecting)…"
                    className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                    style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => decide(test, 'rejected')} disabled={acting === test.id} className="btn-outline btn-md flex-1 justify-center" style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span> Reject
                    </button>
                    <button type="button" onClick={() => decide(test, 'verified')} disabled={acting === test.id} className="btn-primary btn-md flex-1 justify-center" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                      {acting === test.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>}
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
