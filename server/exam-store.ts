import crypto from 'node:crypto';
import { pool, withTransaction, type PoolClient } from '../db/client';
import { writeAuditLog } from './auth-store';
import {
  forgetExamSession,
  rememberExamSession,
  touchExamSession,
  withExamLease,
} from './exam-session-cache';

export type AnswerKey = 'A' | 'B' | 'C' | 'D';

export interface ExamAttemptSnapshot {
  sessionId: string;
  examId: string;
  status: 'active' | 'submitted' | 'expired';
  currentIndex: number;
  durationSeconds: number;
  questionOrder: number[];
  answers: Record<number, AnswerKey>;
  marked: number[];
  startedAt: number;
  submittedAt?: number;
  timeTakenSeconds: number;
}

export interface ExamSubmissionResult {
  sessionId: string;
  examId: string;
  score: number;
  totalScore: number;
  totalPossible: number;
  accuracyPct: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  rank: number;
  percentRank: number;
}

export interface LatestSubmissionRow {
  sessionId: string;
  examId: string;
  score: number;
  totalScore: number;
  totalPossible: number;
  accuracyPct: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  submittedAt: string;
}

function parseQuestionOrder(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseQuestionOrder(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function parseClientMeta(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function getQuestionUuid(client: PoolClient, publicId: number) {
  const result = await client.query<{ id: string }>('SELECT id FROM questions WHERE public_id = $1 LIMIT 1', [publicId]);
  return result.rows[0]?.id ?? null;
}

async function loadAttemptSnapshot(client: PoolClient, attemptId: string) {
  const attempt = await client.query<{
    id: string;
    test_id: string;
    status: 'active' | 'submitted' | 'expired';
    started_at: string;
    submitted_at: string | null;
    time_taken_seconds: number;
    current_index: number;
    question_order: unknown;
    client_meta: unknown;
    lock_token: string;
    code: string;
    duration_seconds: number;
  }>(
    `
    SELECT
      a.id,
      a.test_id,
      a.status,
      a.started_at,
      a.submitted_at,
      a.time_taken_seconds,
      a.current_index,
      a.question_order,
      a.client_meta,
      a.lock_token,
      t.code,
      t.duration_seconds
    FROM attempts a
    JOIN tests t ON t.id = a.test_id
    WHERE a.id = $1
    LIMIT 1;
  `,
    [attemptId],
  );

  const row = attempt.rows[0];
  if (!row) return null;

  const answers = await client.query<{
    selected_option: AnswerKey | null;
    is_marked: boolean;
    public_id: number | null;
  }>(
    `
    SELECT
      aa.selected_option,
      aa.is_marked,
      q.public_id
    FROM attempt_answers aa
    JOIN questions q ON q.id = aa.question_id
    WHERE aa.attempt_id = $1
    ORDER BY q.public_id ASC;
  `,
    [attemptId],
  );

  const answerMap: Record<number, AnswerKey> = {};
  const marked: number[] = [];
  for (const answer of answers.rows) {
    if (answer.public_id == null) continue;
    if (answer.selected_option) {
      answerMap[answer.public_id] = answer.selected_option;
    }
    if (answer.is_marked) {
      marked.push(answer.public_id);
    }
  }

  const meta = parseClientMeta(row.client_meta);
  const questionOrder = parseQuestionOrder(row.question_order).length
    ? parseQuestionOrder(row.question_order)
    : parseQuestionOrder(meta.questionOrder);
  const durationSeconds = Number(row.duration_seconds || meta.durationSeconds || 0);
  const currentIndex = Number(row.current_index || meta.currentIndex || questionOrder[0] || 0);

  return {
    snapshot: {
      sessionId: row.id,
      examId: row.code,
      status: row.status,
      currentIndex,
      durationSeconds,
      questionOrder,
      answers: answerMap,
      marked,
      startedAt: new Date(row.started_at).getTime(),
      submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : undefined,
      timeTakenSeconds: row.time_taken_seconds,
    } satisfies ExamAttemptSnapshot,
    raw: row,
  };
}

function isExpired(startedAt: string, durationSeconds: number) {
  return new Date(startedAt).getTime() + durationSeconds * 1000 + 2 * 60 * 1000 < Date.now();
}

export async function startOrResumeAttempt(params: {
  testCode: string;
  userId: string;
  questionOrder: number[];
  durationSeconds: number;
}) {
  return withTransaction(async (client) => {
    const testResult = await client.query<{ id: string; code: string; duration_seconds: number; total_questions: number }>(
      `
      SELECT id, code, duration_seconds, total_questions
      FROM tests
      WHERE code = $1
      LIMIT 1
      FOR SHARE;
    `,
      [params.testCode],
    );

    const test = testResult.rows[0];
    if (!test) return null;

    const activeAttempt = await client.query<{ id: string }>(
      `
      SELECT id
      FROM attempts
      WHERE test_id = $1
        AND user_id = $2
        AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
      FOR UPDATE;
    `,
      [test.id, params.userId],
    );

    if (activeAttempt.rows[0]) {
      const loaded = await loadAttemptSnapshot(client, activeAttempt.rows[0].id);
      if (loaded?.snapshot) {
        void rememberExamSession(loaded.snapshot);
      }
      return loaded?.snapshot ?? null;
    }

    const lockToken = `exam_${crypto.randomUUID().replace(/-/g, '')}`;
    const clientMeta = {
      questionOrder: params.questionOrder,
      currentIndex: params.questionOrder[0] ?? 1,
      durationSeconds: params.durationSeconds,
    };
    const attempt = await client.query<{ id: string }>(
      `
      INSERT INTO attempts (
        test_id, user_id, status, started_at, time_taken_seconds, current_index,
        question_order, client_meta, lock_token
      )
      VALUES ($1, $2, 'active', now(), 0, $3, $4::jsonb, $5::jsonb, $6)
      RETURNING id;
    `,
      [test.id, params.userId, params.questionOrder[0] ?? 1, JSON.stringify(params.questionOrder), JSON.stringify(clientMeta), lockToken],
    );

    const loaded = await loadAttemptSnapshot(client, attempt.rows[0].id);
    if (loaded?.snapshot) {
      void rememberExamSession(loaded.snapshot);
    }
    return loaded?.snapshot ?? null;
  });
}

export async function getAttemptSnapshot(sessionId: string, userId: string) {
  const client = await pool.connect();
  try {
    const loaded = await loadAttemptSnapshot(client, sessionId);
    if (!loaded) return null;
    const attemptUser = await client.query<{ user_id: string }>('SELECT user_id FROM attempts WHERE id = $1 LIMIT 1', [sessionId]);
    if (attemptUser.rows[0]?.user_id !== userId) return null;
    if (loaded.snapshot.status === 'active') {
      void touchExamSession(loaded.snapshot);
    }
    return loaded.snapshot;
  } finally {
    client.release();
  }
}

async function updateAttemptMeta(
  client: PoolClient,
  attemptId: string,
  currentIndex: number,
  questionOrder?: number[],
) {
  if (questionOrder) {
    await client.query(
      `
      UPDATE attempts
      SET current_index = $2,
          question_order = $3::jsonb,
          client_meta = jsonb_set(
            jsonb_set(client_meta, '{currentIndex}', to_jsonb($2::int), true),
            '{questionOrder}',
            $3::jsonb,
            true
          )
      WHERE id = $1;
    `,
      [attemptId, currentIndex, JSON.stringify(questionOrder)],
    );
    return;
  }
  await client.query(
    `
    UPDATE attempts
    SET current_index = $2,
        client_meta = jsonb_set(client_meta, '{currentIndex}', to_jsonb($2::int), true)
    WHERE id = $1;
  `,
    [attemptId, currentIndex],
  );
}

async function ensureAttemptReady(
  client: PoolClient,
  attemptId: string,
  userId: string,
) {
  const attempt = await client.query<{
    id: string;
    user_id: string;
    status: 'active' | 'submitted' | 'expired';
    started_at: string;
    duration_seconds: number;
    question_order: unknown;
    current_index: number;
    client_meta: unknown;
    test_id: string;
    code: string;
  }>(
    `
    SELECT a.id, a.user_id, a.status, a.started_at, a.duration_seconds, a.question_order, a.current_index, a.client_meta, a.test_id, t.code
    FROM attempts a
    JOIN tests t ON t.id = a.test_id
    WHERE a.id = $1
    FOR UPDATE;
  `,
    [attemptId],
  );
  const row = attempt.rows[0];
  if (!row || row.user_id !== userId) return { status: 'missing' as const };
  if (row.status !== 'active') return { status: row.status as 'submitted' | 'expired', attempt: row };
  if (isExpired(row.started_at, row.duration_seconds)) {
    await client.query(`UPDATE attempts SET status = 'expired' WHERE id = $1`, [attemptId]);
    void forgetExamSession(attemptId);
    return { status: 'expired' as const, attempt: row };
  }
  void touchExamSession({
    sessionId: row.id,
    startedAt: new Date(row.started_at).getTime(),
    durationSeconds: row.duration_seconds,
    status: row.status,
    currentIndex: row.current_index,
  });
  return { status: 'active' as const, attempt: row };
}

export async function recordAttemptAnswer(params: {
  sessionId: string;
  userId: string;
  questionPublicId: number;
  answer: AnswerKey | null;
}) {
  return withExamLease(params.sessionId, () => withTransaction(async (client) => {
    const ready = await ensureAttemptReady(client, params.sessionId, params.userId);
    if (ready.status !== 'active') return null;

    const questionOrder = parseQuestionOrder(ready.attempt.question_order);
    if (!questionOrder.includes(params.questionPublicId)) {
      await writeAuditLog(params.userId, 'student', 'exam_tamper_attempt', `Question ${params.questionPublicId} not in session order`, 'warning', {
        sessionId: params.sessionId,
      });
      return null;
    }

    const questionUuid = await getQuestionUuid(client, params.questionPublicId);
    if (!questionUuid) {
      await writeAuditLog(params.userId, 'student', 'exam_tamper_attempt', `Unknown question ${params.questionPublicId}`, 'warning', {
        sessionId: params.sessionId,
      });
      return null;
    }

    await client.query(
      `
      INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_marked, answered_at)
      VALUES ($1, $2, $3, COALESCE((SELECT is_marked FROM attempt_answers WHERE attempt_id = $1 AND question_id = $2), false), now())
      ON CONFLICT (attempt_id, question_id) DO UPDATE SET
        selected_option = EXCLUDED.selected_option,
        answered_at = now();
    `,
      [params.sessionId, questionUuid, params.answer],
    );

    await updateAttemptMeta(client, params.sessionId, params.questionPublicId, questionOrder);
    return params.questionPublicId;
  }));
}

export async function clearAttemptAnswer(params: { sessionId: string; userId: string; questionPublicId: number }) {
  return recordAttemptAnswer({
    sessionId: params.sessionId,
    userId: params.userId,
    questionPublicId: params.questionPublicId,
    answer: null,
  });
}

export async function markAttemptQuestion(params: {
  sessionId: string;
  userId: string;
  questionPublicId: number;
  marked: boolean;
}) {
  return withExamLease(params.sessionId, () => withTransaction(async (client) => {
    const ready = await ensureAttemptReady(client, params.sessionId, params.userId);
    if (ready.status !== 'active') return null;

    const questionOrder = parseQuestionOrder(ready.attempt.question_order);
    if (!questionOrder.includes(params.questionPublicId)) {
      await writeAuditLog(params.userId, 'student', 'exam_tamper_attempt', `Mark update for invalid question ${params.questionPublicId}`, 'warning', {
        sessionId: params.sessionId,
      });
      return null;
    }

    const questionUuid = await getQuestionUuid(client, params.questionPublicId);
    if (!questionUuid) return null;

    await client.query(
      `
      INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_marked, answered_at)
      VALUES ($1, $2, (SELECT selected_option FROM attempt_answers WHERE attempt_id = $1 AND question_id = $2), $3, now())
      ON CONFLICT (attempt_id, question_id) DO UPDATE SET
        is_marked = EXCLUDED.is_marked,
        answered_at = now();
    `,
      [params.sessionId, questionUuid, params.marked],
    );

    await updateAttemptMeta(client, params.sessionId, ready.attempt.current_index, questionOrder);
    return params.questionPublicId;
  }));
}

export async function submitAttempt(params: {
  sessionId: string;
  userId: string;
  answers?: Record<string, AnswerKey>;
}) {
  return withExamLease(params.sessionId, () => withTransaction(async (client) => {
    const ready = await ensureAttemptReady(client, params.sessionId, params.userId);
    if (ready.status !== 'active') return null;

    const questionOrder = parseQuestionOrder(ready.attempt.question_order);
    const payloadAnswers = params.answers ?? {};
    const payloadIds = Object.keys(payloadAnswers)
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const unexpectedIds = payloadIds.filter((id) => !questionOrder.includes(id));
    if (unexpectedIds.length > 0) {
      await writeAuditLog(
        params.userId,
        'student',
        'exam_submit_tamper_attempt',
        `Submit payload included invalid questions: ${unexpectedIds.join(', ')}`,
        'warning',
        { sessionId: params.sessionId },
      );
    }

    const answerRows = await client.query<{
      public_id: number;
      selected_option: AnswerKey | null;
      correct_option: AnswerKey;
    }>(
      `
      SELECT q.public_id, aa.selected_option, q.correct_option
      FROM attempt_answers aa
      JOIN questions q ON q.id = aa.question_id
      WHERE aa.attempt_id = $1
      ORDER BY q.public_id ASC;
    `,
      [params.sessionId],
    );

    const answerMap = new Map<number, { selected: AnswerKey | null; correct: AnswerKey }>();
    for (const row of answerRows.rows) {
      answerMap.set(row.public_id, { selected: row.selected_option, correct: row.correct_option });
    }

    for (const [questionId, answer] of Object.entries(payloadAnswers)) {
      const publicId = Number(questionId);
      const stored = answerMap.get(publicId);
      if (stored && stored.selected !== answer) {
        await writeAuditLog(
          params.userId,
          'student',
          'exam_submit_tamper_attempt',
          `Submit payload disagreed with stored answer for question ${publicId}`,
          'warning',
          { sessionId: params.sessionId },
        );
      }
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    for (const questionId of questionOrder) {
      const row = answerMap.get(questionId);
      if (!row || row.selected == null) {
        skippedCount += 1;
        continue;
      }
      if (row.selected === row.correct) {
        correctCount += 1;
      } else {
        incorrectCount += 1;
      }
    }

    const totalQuestions = questionOrder.length || answerRows.rows.length;
    const totalPossible = totalQuestions * 4;
    const score = correctCount * 4 - incorrectCount;
    const accuracyPct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const timeTakenSeconds = Math.max(0, Math.floor((Date.now() - new Date(ready.attempt.started_at).getTime()) / 1000));

    await client.query(
      `
      INSERT INTO scores (
        attempt_id, total_score, total_possible, correct_count, incorrect_count,
        skipped_count, accuracy_pct, rank_in_batch, percentile, computed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, now())
      ON CONFLICT (attempt_id) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        total_possible = EXCLUDED.total_possible,
        correct_count = EXCLUDED.correct_count,
        incorrect_count = EXCLUDED.incorrect_count,
        skipped_count = EXCLUDED.skipped_count,
        accuracy_pct = EXCLUDED.accuracy_pct,
        computed_at = EXCLUDED.computed_at;
    `,
      [params.sessionId, score, totalPossible, correctCount, incorrectCount, skippedCount, accuracyPct],
    );

    await client.query(
      `
      UPDATE attempts
      SET status = 'submitted',
          submitted_at = now(),
          time_taken_seconds = $2,
          current_index = COALESCE(current_index, 0)
      WHERE id = $1;
    `,
      [params.sessionId, timeTakenSeconds],
    );
    void forgetExamSession(params.sessionId);

    const percentRank = Math.max(1, 100 - accuracyPct);
    const rank = Math.max(1, Math.ceil((100 - accuracyPct) / 4));

    return {
      sessionId: params.sessionId,
      examId: ready.attempt.code,
      score,
      totalScore: score,
      totalPossible,
      accuracyPct,
      correctCount,
      incorrectCount,
      skippedCount,
      rank,
      percentRank,
    } satisfies ExamSubmissionResult;
  }));
}

export async function getLatestSubmissionForUser(userId: string) {
  const result = await pool.query<{
    session_id: string;
    exam_id: string;
    total_score: number;
    total_possible: number;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    accuracy_pct: number;
    submitted_at: string;
  }>(
    `
    SELECT
      s.attempt_id AS session_id,
      t.code AS exam_id,
      s.total_score,
      s.total_possible,
      s.correct_count,
      s.incorrect_count,
      s.skipped_count,
      s.accuracy_pct,
      s.computed_at AS submitted_at
    FROM scores s
    JOIN attempts a ON a.id = s.attempt_id
    JOIN tests t ON t.id = a.test_id
    WHERE a.user_id = $1
      AND a.status = 'submitted'
    ORDER BY s.computed_at DESC
    LIMIT 1;
  `,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    sessionId: row.session_id,
    examId: row.exam_id,
    score: Number(row.total_score),
    totalScore: Number(row.total_score),
    totalPossible: Number(row.total_possible),
    accuracyPct: Number(row.accuracy_pct),
    correctCount: Number(row.correct_count),
    incorrectCount: Number(row.incorrect_count),
    skippedCount: Number(row.skipped_count),
    submittedAt: row.submitted_at,
  } satisfies LatestSubmissionRow;
}

export async function countActiveExamSessions() {
  const result = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM attempts
    WHERE status = 'active';
  `,
  );
  return Number(result.rows[0]?.count ?? 0);
}
