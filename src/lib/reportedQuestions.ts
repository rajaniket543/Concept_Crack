import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  listAllQuestionFlags, resolveQuestionFlag, type QuestionFlag, type FlagReason,
} from './questionFlags';
import {
  getBankQuestion, updateBankQuestion, deleteBankQuestion, listBankQuestions,
  type BankQuestion, type BankQuestionInput,
} from './questionBank';
import { logQuestionHistory } from './questionHistory';
import { todayKey } from './dailyChallenge';

export interface ReportedQuestionRow {
  questionId: string;
  question: BankQuestion | null;
  reports: QuestionFlag[];
  reportCount: number;
  latestReportAt: string;
  reasons: FlagReason[];
  status: 'open' | 'resolved';
}

export interface ReportedQuestionFilters {
  subject?: string;
  topic?: string;
  status?: 'open' | 'resolved';
  reason?: FlagReason;
  difficulty?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Groups every report by the real question it's about — one table row per
 *  question, even if several students reported it for different reasons. */
export async function listReportedQuestions(filters: ReportedQuestionFilters = {}): Promise<ReportedQuestionRow[]> {
  const flags = await listAllQuestionFlags();
  const byQuestion = new Map<string, QuestionFlag[]>();
  for (const f of flags) {
    const list = byQuestion.get(f.questionId) ?? [];
    list.push(f);
    byQuestion.set(f.questionId, list);
  }

  const rows: ReportedQuestionRow[] = [];
  for (const [questionId, reports] of byQuestion) {
    const question = await getBankQuestion(questionId).catch(() => null);
    const status: ReportedQuestionRow['status'] = reports.some(r => r.status === 'open') ? 'open' : 'resolved';
    rows.push({
      questionId,
      question,
      reports: reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      reportCount: reports.length,
      latestReportAt: reports.reduce((max, r) => (r.createdAt > max ? r.createdAt : max), ''),
      reasons: [...new Set(reports.map(r => r.reason))],
      status,
    });
  }

  return rows
    .filter(r => !filters.subject   || r.question?.subject === filters.subject)
    .filter(r => !filters.topic     || (r.question?.topic ?? '').toLowerCase().includes(filters.topic.toLowerCase()))
    .filter(r => !filters.status    || r.status === filters.status)
    .filter(r => !filters.reason    || r.reasons.includes(filters.reason))
    .filter(r => !filters.difficulty || r.question?.difficulty === filters.difficulty)
    .filter(r => !filters.dateFrom  || r.latestReportAt >= filters.dateFrom)
    .filter(r => !filters.dateTo    || r.latestReportAt <= filters.dateTo)
    .sort((a, b) => b.latestReportAt.localeCompare(a.latestReportAt));
}

interface Actor { id: string; name: string }

/** Outcome of a review action. The primary change either happened or threw;
 *  `warnings` lists follow-up bookkeeping (marking reports resolved, writing
 *  the audit entry) that didn't complete. Keeping these apart matters: if the
 *  question edit succeeded, saying "failed to save" would be a lie that makes
 *  faculty re-apply an edit that's already live. */
export interface ActionResult {
  warnings: string[];
}

/** Marks reports resolved, best-effort. Returns what couldn't be done. */
async function resolveAll(reports: QuestionFlag[], resolution: 'approved' | 'rejected', note?: string): Promise<string[]> {
  const open = reports.filter(r => r.status === 'open');
  if (open.length === 0) return [];
  try {
    for (const r of open) await resolveQuestionFlag(r.id, resolution, note);
    return [];
  } catch (e) {
    console.error('Could not mark report(s) resolved:', e);
    return ['the report is still showing as open'];
  }
}

/** Writes the audit entry, best-effort. Returns what couldn't be done. */
async function logBestEffort(entry: Parameters<typeof logQuestionHistory>[0]): Promise<string[]> {
  try {
    await logQuestionHistory(entry);
    return [];
  } catch (e) {
    console.error('Could not write the question-history entry:', e);
    return ['it was not recorded in the edit history'];
  }
}

/** Leaves the question as-is; the report(s) are simply acknowledged. */
export async function approveReports(reports: QuestionFlag[], actor: Actor): Promise<ActionResult> {
  // Resolving the reports IS the action here, so a failure is a real failure.
  const open = reports.filter(r => r.status === 'open');
  for (const r of open) await resolveQuestionFlag(r.id, 'approved');
  const questionId = reports[0]?.questionId;
  const warnings = questionId
    ? await logBestEffort({ questionId, action: 'approved', actorId: actor.id, actorName: actor.name })
    : [];
  return { warnings };
}

export async function rejectReport(flag: QuestionFlag, note: string, actor: Actor): Promise<ActionResult> {
  await resolveQuestionFlag(flag.id, 'rejected', note);
  const warnings = await logBestEffort({
    questionId: flag.questionId, action: 'report_rejected',
    actorId: actor.id, actorName: actor.name, note,
  });
  return { warnings };
}

export async function editReportedQuestion(
  questionId: string, patch: Partial<BankQuestionInput>, reports: QuestionFlag[], actor: Actor
): Promise<ActionResult> {
  const before = await getBankQuestion(questionId).catch(() => null);
  // The only critical write — if this throws, nothing was saved and the
  // caller should report a genuine failure.
  await updateBankQuestion(questionId, patch);
  return {
    warnings: [
      ...await resolveAll(reports, 'approved'),
      ...await logBestEffort({
        questionId, action: 'edited', actorId: actor.id, actorName: actor.name,
        before: before ? { ...before } : undefined,
        after: { ...before, ...patch },
      }),
    ],
  };
}

// Daily-challenge test docs use a predictable id (`daily_${date}_${stream}`),
// created lazily — "future" challenges simply don't exist yet, so only
// today's doc (per stream) can ever need a live swap. Never touches a past
// day's doc, matching the confirmed "no rewriting history" scope.
async function swapInTodaysDailyChallenges(oldQuestionId: string, newQuestionId: string): Promise<string[]> {
  const date = todayKey();
  const affected: string[] = [];
  for (const stream of ['JEE', 'NEET']) {
    const id = `daily_${date}_${stream}`;
    const ref = doc(db, 'tests', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const questionIds = (snap.data().questionIds as string[]) ?? [];
    const idx = questionIds.indexOf(oldQuestionId);
    if (idx === -1) continue;
    const updated = [...questionIds];
    updated[idx] = newQuestionId;
    await updateDoc(ref, { questionIds: updated, updatedAt: serverTimestamp() });
    affected.push(id);
  }
  return affected;
}

export async function replaceReportedQuestion(
  oldQuestionId: string, newQuestionId: string, reports: QuestionFlag[], actor: Actor
): Promise<ActionResult> {
  const affectedTestIds = await swapInTodaysDailyChallenges(oldQuestionId, newQuestionId);
  return {
    warnings: [
      ...await resolveAll(reports, 'approved'),
      ...await logBestEffort({
        questionId: oldQuestionId, action: 'replaced', actorId: actor.id, actorName: actor.name,
        replacedWithQuestionId: newQuestionId, affectedTestIds,
      }),
    ],
  };
}

export async function findReplacementCandidates(subject: string, chapter: string, excludeId: string): Promise<BankQuestion[]> {
  const list = await listBankQuestions({ subject, chapter });
  return list.filter(q => q.id !== excludeId && q.verificationStatus !== 'unverified');
}

export async function deleteReportedQuestion(
  question: BankQuestion, reports: QuestionFlag[], actor: Actor
): Promise<ActionResult> {
  // Archive first — deliberately NOT best-effort. If the copy can't be
  // written we must not delete the original, or the question is gone for good.
  await setDoc(doc(db, 'archivedQuestions', question.id), {
    ...question,
    archivedAt: serverTimestamp(),
    archivedBy: actor.id,
  });

  const candidates = await findReplacementCandidates(question.subject, question.chapter, question.id)
    .catch(() => [] as BankQuestion[]);
  let affectedTestIds: string[] = [];
  if (candidates.length > 0) {
    affectedTestIds = await swapInTodaysDailyChallenges(question.id, candidates[0].id);
  }

  await deleteBankQuestion(question.id);

  const warnings = [
    ...(candidates.length === 0 ? ['no same-chapter replacement was available'] : []),
    ...await resolveAll(reports, 'approved'),
    ...await logBestEffort({
      questionId: question.id, action: 'deleted', actorId: actor.id, actorName: actor.name,
      replacedWithQuestionId: candidates[0]?.id, affectedTestIds,
    }),
  ];
  return { warnings };
}
