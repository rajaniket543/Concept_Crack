import { Fragment, useEffect, useState } from 'react';
import TopBar from '../../components/TopBar';
import MathText from '../../components/MathText';
import QuestionForm, { SUBJECTS, DIFFICULTIES, EMPTY_DRAFT, type Draft } from '../../components/QuestionForm';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { getAuthSession } from '../../lib/auth';
import { FLAG_REASONS, type FlagReason, type QuestionFlag } from '../../lib/questionFlags';
import type { BankQuestion, BankQuestionInput } from '../../lib/questionBank';
import { getQuestionHistory, type QuestionHistoryEntry } from '../../lib/questionHistory';
import {
  listReportedQuestions, approveReports, rejectReport, editReportedQuestion,
  replaceReportedQuestion, deleteReportedQuestion, findReplacementCandidates,
  type ReportedQuestionRow, type ReportedQuestionFilters,
} from '../../lib/reportedQuestions';

const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

function draftFromQuestion(q: BankQuestion): Draft {
  return {
    question: q.question, A: q.options.A, B: q.options.B, C: q.options.C, D: q.options.D,
    answer: (q.answer ?? 'A') as Draft['answer'],
    subject: q.subject || 'Physics', chapter: q.chapter, topic: q.topic ?? '',
    difficulty: q.difficulty, origin: (q.origin as Draft['origin']) ?? 'Custom',
    explanation: q.explanation ?? '', imageUrl: q.imageUrl ?? '',
  };
}

function draftToPatch(d: Draft): Partial<BankQuestionInput> {
  return {
    question: d.question.trim(),
    options: { A: d.A, B: d.B, C: d.C, D: d.D },
    answer: d.answer,
    subject: d.subject,
    chapter: d.chapter,
    topic: d.topic,
    difficulty: d.difficulty,
    origin: d.origin,
    explanation: d.explanation,
    imageUrl: d.imageUrl || undefined,
  };
}

export default function ReportedQuestions() {
  const toast = useToast();
  const confirm = useConfirm();
  const session = getAuthSession();
  const actor = { id: session?.user?.id ?? '', name: session?.user?.name ?? 'Faculty' };

  const [rows, setRows] = useState<ReportedQuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportedQuestionFilters>({ status: 'open' });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, QuestionHistoryEntry[]>>({});
  const [acting, setActing] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<BankQuestion[]>([]);

  const [rejectingFlag, setRejectingFlag] = useState<QuestionFlag | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  function load() {
    setLoading(true);
    listReportedQuestions(filters).then(setRows).finally(() => setLoading(false));
  }

  useEffect(load, [filters.subject, filters.status, filters.reason, filters.difficulty]);

  async function toggleExpand(row: ReportedQuestionRow) {
    if (expanded === row.questionId) { setExpanded(null); return; }
    setExpanded(row.questionId);
    if (!history[row.questionId]) {
      const h = await getQuestionHistory(row.questionId).catch(() => []);
      setHistory(prev => ({ ...prev, [row.questionId]: h }));
    }
  }

  async function handleApprove(row: ReportedQuestionRow) {
    setActing(row.questionId);
    try {
      await approveReports(row.reports.filter(r => r.status === 'open'), actor);
      toast('Approved — question left as-is', 'success');
      load();
    } catch { toast('Failed to approve', 'error'); }
    finally { setActing(null); }
  }

  async function handleRejectReport() {
    if (!rejectingFlag) return;
    if (!rejectNote.trim()) { toast('Add a note explaining the rejection', 'error'); return; }
    setActing(rejectingFlag.questionId);
    try {
      await rejectReport(rejectingFlag, rejectNote.trim(), actor);
      toast('Report rejected', 'success');
      setRejectingFlag(null);
      setRejectNote('');
      load();
    } catch { toast('Failed to reject report', 'error'); }
    finally { setActing(null); }
  }

  function openEdit(row: ReportedQuestionRow) {
    if (!row.question) return;
    setEditingId(row.questionId);
    setEditDraft(draftFromQuestion(row.question));
  }

  async function saveEdit(row: ReportedQuestionRow) {
    if (!editDraft.question.trim() || !editDraft.A.trim() || !editDraft.B.trim()) {
      toast('Question, and at least options A & B, are required', 'error');
      return;
    }
    setActing(row.questionId);
    try {
      await editReportedQuestion(row.questionId, draftToPatch(editDraft), row.reports, actor);
      toast('Question updated', 'success');
      setEditingId(null);
      load();
    } catch { toast('Failed to save changes', 'error'); }
    finally { setActing(null); }
  }

  async function openReplace(row: ReportedQuestionRow) {
    if (!row.question) return;
    setReplacingId(row.questionId);
    const list = await findReplacementCandidates(row.question.subject, row.question.chapter, row.questionId);
    setCandidates(list);
  }

  async function doReplace(row: ReportedQuestionRow, newQuestionId: string) {
    setActing(row.questionId);
    try {
      await replaceReportedQuestion(row.questionId, newQuestionId, row.reports, actor);
      toast('Question replaced in today\'s active challenges', 'success');
      setReplacingId(null);
      load();
    } catch { toast('Failed to replace question', 'error'); }
    finally { setActing(null); }
  }

  async function handleDelete(row: ReportedQuestionRow) {
    if (!row.question) return;
    const ok = await confirm({
      title: 'Delete this question?',
      message: `"${row.question.question.slice(0, 80)}${row.question.question.length > 80 ? '…' : ''}" will be archived and removed from the bank. A same-subject/chapter replacement will be picked automatically for today's active challenges.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      icon: 'delete',
    });
    if (!ok) return;
    setActing(row.questionId);
    try {
      await deleteReportedQuestion(row.question, row.reports, actor);
      toast('Question archived and deleted', 'success');
      load();
    } catch { toast('Failed to delete question', 'error'); }
    finally { setActing(null); }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Dashboard', href: '/faculty' }, { label: 'Reported Questions' }]} />

      <div className="flex-1 p-6 space-y-5 overflow-auto">
        <div>
          <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Reported Questions</h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Questions students have flagged as wrong, unclear, or otherwise problematic.
          </p>
        </div>

        {/* Filters */}
        <div className="rounded-2xl p-4 flex flex-wrap gap-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <select value={filters.subject ?? ''} onChange={e => setFilters(f => ({ ...f, subject: e.target.value || undefined }))} className="input-field" style={inputStyle}>
            <option value="">All subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.difficulty ?? ''} onChange={e => setFilters(f => ({ ...f, difficulty: e.target.value || undefined }))} className="input-field" style={inputStyle}>
            <option value="">All difficulties</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filters.reason ?? ''} onChange={e => setFilters(f => ({ ...f, reason: (e.target.value || undefined) as FlagReason | undefined }))} className="input-field" style={inputStyle}>
            <option value="">All reasons</option>
            {FLAG_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filters.status ?? ''} onChange={e => setFilters(f => ({ ...f, status: (e.target.value || undefined) as 'open' | 'resolved' | undefined }))} className="input-field" style={inputStyle}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          <input
            type="text" placeholder="Filter by topic…"
            value={filters.topic ?? ''} onChange={e => setFilters(f => ({ ...f, topic: e.target.value || undefined }))}
            className="input-field flex-1 min-w-[160px]" style={inputStyle}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
            <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--text-faint)' }}>flag</span>
            <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>Nothing reported</p>
            <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>No questions match these filters.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Subject / Topic</th>
                  <th>Difficulty</th>
                  <th>Reports</th>
                  <th>Latest</th>
                  <th>Reasons</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <Fragment key={row.questionId}>
                    <tr>
                      <td className="max-w-xs truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                        {row.question ? <MathText text={row.question.question} /> : <span style={{ color: 'var(--text-faint)' }}>(question deleted)</span>}
                      </td>
                      <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.question?.subject} / {row.question?.topic || row.question?.chapter}</td>
                      <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.question?.difficulty}</td>
                      <td className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.reportCount}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(row.latestReportAt).toLocaleDateString()}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.reasons.join(', ')}</td>
                      <td>
                        <span className="badge" style={row.status === 'open' ? { backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' } : { backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <button type="button" onClick={() => void toggleExpand(row)} className="btn-outline btn-sm">
                          {expanded === row.questionId ? 'Hide' : 'Review'}
                        </button>
                      </td>
                    </tr>
                    {expanded === row.questionId && (
                      <tr>
                        <td colSpan={8} className="p-4" style={{ backgroundColor: 'var(--surface-muted)' }}>
                          {!row.question ? (
                            <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>This question no longer exists in the bank.</p>
                          ) : editingId === row.questionId ? (
                            <div className="space-y-3">
                              <QuestionForm draft={editDraft} setDraft={setEditDraft} uid={actor.id} />
                              <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => setEditingId(null)} className="btn-outline btn-sm">Cancel</button>
                                <button type="button" onClick={() => void saveEdit(row)} disabled={acting === row.questionId} className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                                  {acting === row.questionId ? 'Saving…' : 'Save changes'}
                                </button>
                              </div>
                            </div>
                          ) : replacingId === row.questionId ? (
                            <div className="space-y-2">
                              <p className="text-label-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Pick a replacement from the same subject/chapter:</p>
                              {candidates.length === 0 ? (
                                <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>No other approved questions found for this subject/chapter.</p>
                              ) : (
                                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                  {candidates.map(c => (
                                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg p-2.5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                                      <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}><MathText text={c.question} /></span>
                                      <button type="button" onClick={() => void doReplace(row, c.id)} disabled={acting === row.questionId} className="btn-primary btn-sm shrink-0">Use this</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex justify-end">
                                <button type="button" onClick={() => setReplacingId(null)} className="btn-outline btn-sm">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Full question */}
                              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                                {row.question.imageUrl && <img src={row.question.imageUrl} alt="Question figure" className="rounded-lg max-h-48 mb-2" />}
                                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}><MathText text={row.question.question} /></p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
                                  {(['A', 'B', 'C', 'D'] as const).map(k => (
                                    <div key={k} className="text-xs flex items-center gap-1.5" style={{ color: row.question!.answer === k ? '#059669' : 'var(--text-muted)' }}>
                                      <span className="font-bold">{k}.</span> <MathText text={row.question!.options[k]} />
                                      {row.question!.answer === k && <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>}
                                    </div>
                                  ))}
                                </div>
                                {row.question.explanation && (
                                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Explanation: {row.question.explanation}</p>
                                )}
                              </div>

                              {/* All reports */}
                              <div className="space-y-1.5">
                                <p className="text-label-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Reports ({row.reports.length})</p>
                                {row.reports.map(r => (
                                  <div key={r.id} className="rounded-lg p-2.5 flex items-start justify-between gap-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                                    <div>
                                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.reason}</span>
                                      <span className="text-xs ml-2" style={{ color: 'var(--text-faint)' }}>by {r.flaggedByName} · {new Date(r.createdAt).toLocaleDateString()}</span>
                                      {r.comment && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.comment}</p>}
                                    </div>
                                    {r.status === 'open' && (
                                      <button type="button" onClick={() => { setRejectingFlag(r); setRejectNote(''); }} className="text-label-sm font-semibold shrink-0" style={{ color: '#EF4444' }}>
                                        Reject report
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {rejectingFlag && rejectingFlag.questionId === row.questionId && (
                                <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(239,68,68,0.30)' }}>
                                  <textarea
                                    value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}
                                    placeholder="Why is this report being rejected? (required)"
                                    className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={inputStyle}
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button type="button" onClick={() => setRejectingFlag(null)} className="btn-outline btn-sm">Cancel</button>
                                    <button type="button" onClick={() => void handleRejectReport()} disabled={acting === row.questionId} className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Edit history */}
                              {(history[row.questionId]?.length ?? 0) > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-label-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Edit history</p>
                                  {history[row.questionId].map(h => (
                                    <div key={h.id} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                      {h.action} by {h.actorName} · {new Date(h.createdAt).toLocaleString()}{h.note ? ` — ${h.note}` : ''}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 flex-wrap">
                                <button type="button" onClick={() => void handleApprove(row)} disabled={acting === row.questionId || row.status === 'resolved'} className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span> Approve
                                </button>
                                <button type="button" onClick={() => openEdit(row)} disabled={acting === row.questionId} className="btn-outline btn-sm">
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span> Edit
                                </button>
                                <button type="button" onClick={() => void openReplace(row)} disabled={acting === row.questionId} className="btn-outline btn-sm">
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>swap_horiz</span> Replace
                                </button>
                                <button type="button" onClick={() => void handleDelete(row)} disabled={acting === row.questionId} className="btn-outline btn-sm" style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span> Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
