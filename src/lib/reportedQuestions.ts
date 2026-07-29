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

/** Leaves the question as-is; the report(s) are simply acknowledged. */
export async function approveReports(reports: QuestionFlag[], actor: Actor): Promise<void> {
  for (const r of reports) await resolveQuestionFlag(r.id, 'approved');
  const questionId = reports[0]?.questionId;
  if (questionId) {
    await logQuestionHistory({ questionId, action: 'approved', actorId: actor.id, actorName: actor.name });
  }
}

export async function rejectReport(flag: QuestionFlag, note: string, actor: Actor): Promise<void> {
  await resolveQuestionFlag(flag.id, 'rejected', note);
  await logQuestionHistory({
    questionId: flag.questionId, action: 'report_rejected',
    actorId: actor.id, actorName: actor.name, note,
  });
}

export async function editReportedQuestion(
  questionId: string, patch: Partial<BankQuestionInput>, reports: QuestionFlag[], actor: Actor
): Promise<void> {
  const before = await getBankQuestion(questionId);
  await updateBankQuestion(questionId, patch);
  for (const r of reports.filter(r => r.status === 'open')) await resolveQuestionFlag(r.id, 'approved');
  await logQuestionHistory({
    questionId, action: 'edited', actorId: actor.id, actorName: actor.name,
    before: before ? { ...before } : undefined,
    after: { ...before, ...patch },
  });
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
): Promise<void> {
  const affectedTestIds = await swapInTodaysDailyChallenges(oldQuestionId, newQuestionId);
  for (const r of reports.filter(r => r.status === 'open')) await resolveQuestionFlag(r.id, 'approved');
  await logQuestionHistory({
    questionId: oldQuestionId, action: 'replaced', actorId: actor.id, actorName: actor.name,
    replacedWithQuestionId: newQuestionId, affectedTestIds,
  });
}

export async function findReplacementCandidates(subject: string, chapter: string, excludeId: string): Promise<BankQuestion[]> {
  const list = await listBankQuestions({ subject, chapter });
  return list.filter(q => q.id !== excludeId && q.verificationStatus !== 'unverified');
}

export async function deleteReportedQuestion(
  question: BankQuestion, reports: QuestionFlag[], actor: Actor
): Promise<void> {
  await setDoc(doc(db, 'archivedQuestions', question.id), {
    ...question,
    archivedAt: serverTimestamp(),
    archivedBy: actor.id,
  });

  const candidates = await findReplacementCandidates(question.subject, question.chapter, question.id);
  let affectedTestIds: string[] = [];
  if (candidates.length > 0) {
    affectedTestIds = await swapInTodaysDailyChallenges(question.id, candidates[0].id);
  }

  await deleteBankQuestion(question.id);
  for (const r of reports.filter(r => r.status === 'open')) await resolveQuestionFlag(r.id, 'approved');
  await logQuestionHistory({
    questionId: question.id, action: 'deleted', actorId: actor.id, actorName: actor.name,
    replacedWithQuestionId: candidates[0]?.id, affectedTestIds,
  });
}
