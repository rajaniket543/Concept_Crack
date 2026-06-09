import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import {
  countActiveSessions,
  consumeResetToken,
  createOtpChallenge as createDbOtpChallenge,
  createResetToken as createDbResetToken,
  createSession as createDbSession,
  findUserByIdentifier,
  findUserById,
  getSessionFromToken,
  listAuditLogs,
  listNotifications,
  revokeSession,
  updatePassword,
  verifyOtpChallenge,
  writeAuditLog,
  writeNotification,
} from './auth-store';
import {
  clearAttemptAnswer,
  countActiveExamSessions,
  getAttemptSnapshot,
  markAttemptQuestion,
  recordAttemptAnswer,
  startOrResumeAttempt,
  submitAttempt,
  type ExamAttemptSnapshot,
  type ExamSubmissionResult,
} from './exam-store';
import {
  buildStudentAnalysis,
  buildStudentDashboardData,
  buildStudentInsights,
  buildStudentLeaderboard,
} from './analytics-store';
import {
  buildFacultyDashboard,
  buildFacultyQuestionBank,
  buildParentDashboard,
} from './portal-analytics-store';
import {
  buildWeeklyReports,
  queueWeeklyReportNotifications,
} from './report-store';
import {
  getAdminDashboardData,
  listAdminInstitutes,
  listAdminUsers,
  listReferenceRoles,
} from './admin-store';
import {
  analysis as staticAnalysis,
  examMeta,
  practiceModules,
} from '../src/mocks/student';
import {
  healthLogs,
} from '../src/mocks/portal';
import { createToken, verifyPassword } from './security';
import { DemoAccount, Role, demoAccounts, rolePermissions, seed, seedQuestions, userDirectory } from './seed';

type ExamStatus = 'active' | 'submitted';
type AnswerKey = 'A' | 'B' | 'C' | 'D';

interface AuthSession {
  token: string;
  userId: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
}

interface OtpChallenge {
  challengeId: string;
  userId: string;
  role: Role;
  code: string;
  expiresAt: number;
}

interface ResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: Role;
  action: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
}

interface ExamSession {
  sessionId: string;
  examId: string;
  userId: string;
  role: Role;
  status: ExamStatus;
  questionOrder: number[];
  answers: Record<number, AnswerKey>;
  marked: number[];
  currentIndex: number;
  startedAt: number;
  durationSeconds: number;
  submittedAt?: number;
}

interface SubmissionResult {
  sessionId: string;
  examId: string;
  score: number;
  totalScore: number;
  totalPossible: number;
  accuracyPct: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  topicPerformance: typeof staticAnalysis.topicPerformance;
  rank: number;
  percentRank: number;
}

interface AppState {
  rateLimit: Map<string, { count: number; resetAt: number }>;
}

const state: AppState = {
  rateLimit: new Map(),
};

function now() {
  return Date.now();
}

function sendError(res: Response, status: number, message: string, extra?: Record<string, unknown>) {
  return res.status(status).json({
    ok: false,
    error: {
      message,
      ...(extra ?? {}),
    },
  });
}

function sendOk<T>(res: Response, data: T) {
  return res.json({ ok: true, data });
}

function addAudit(actorId: string, actorRole: Role, action: string, detail: string, severity: AuditLog['severity'] = 'info') {
  void writeAuditLog(actorId === 'unknown' ? null : actorId, actorRole, action, detail, severity);
}

function addNotification(title: string, body: string, role?: Role) {
  void writeNotification(title, body, role);
}

function rateLimit(windowMs: number, limit: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip ?? 'unknown'}:${req.path}`;
    const bucket = state.rateLimit.get(key);
    const current = now();
    if (!bucket || bucket.resetAt <= current) {
      state.rateLimit.set(key, { count: 1, resetAt: current + windowMs });
      return next();
    }
    if (bucket.count >= limit) {
      return sendError(res, 429, 'Too many requests. Please try again shortly.');
    }
    bucket.count += 1;
    return next();
  };
}

async function getRoleFromRequest(req: Request) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  return getSessionFromToken(token);
}

type RequestAuth = Awaited<ReturnType<typeof getRoleFromRequest>>;

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await getRoleFromRequest(req);
    if (!auth) return sendError(res, 401, 'Authentication required.');
    (req as Request & { auth?: typeof auth }).auth = auth;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth?: RequestAuth }).auth;
    if (!auth) return sendError(res, 401, 'Authentication required.');
    if (!roles.includes(auth.user.role)) return sendError(res, 403, 'Insufficient permissions.');
    return next();
  };
}

function getBodyString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function correctKeyForQuestion(id: number) {
  return (['A', 'B', 'C', 'D'][(id * 7) % 4] ?? 'A') as AnswerKey;
}

function hashSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function shuffleDeterministic(values: number[], seed: string) {
  const arr = [...values];
  let state = hashSeed(seed) || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildExamQuestionPayload(order?: number[]) {
  const questions = (order ?? seedQuestions.map((q) => q.id)).map((questionId) => {
    const question = seedQuestions.find((item) => item.id === questionId)!;
    const { correctKey, ...rest } = question;
    return rest;
  });
  return questions;
}

async function buildAnalysisFromSubmission(userId: string) {
  return buildStudentAnalysis(userId);
}

async function buildLeaderboardForUser(userId: string) {
  return buildStudentLeaderboard(userId);
}

function getClientIp(req: Request) {
  return String(req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', rateLimit(60_000, 20));
app.use('/api', rateLimit(60_000, 120));

app.get('/api/health', async (_req, res) => {
  return sendOk(res, {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    activeSessions: await countActiveSessions(),
    activeExamSessions: await countActiveExamSessions(),
  });
});

app.post('/api/auth/login', async (req, res) => {
  const identifier = getBodyString(req.body.identifier);
  const password = getBodyString(req.body.password);
  const role = getBodyString(req.body.role) as Role;
  const method = getBodyString(req.body.method) as 'email' | 'mobile' | 'otp';

  if (!identifier || !role) {
    return sendError(res, 400, 'Identifier and role are required.');
  }

  const user = await findUserByIdentifier(identifier, role);
  if (!user) {
    addAudit('unknown', role, 'login_failed', `Unknown identifier ${identifier}`, 'warning');
    return sendError(res, 401, 'Invalid credentials.');
  }

  if (method === 'otp') {
    return sendError(res, 400, 'Use /api/auth/request-otp and /api/auth/verify-otp for OTP sign-in.');
  }

  if (!password || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    addAudit(user.id, user.role, 'login_failed', `Password mismatch from ${getClientIp(req)}`, 'warning');
    return sendError(res, 401, 'Invalid credentials.');
  }

  const session = await createDbSession(user.id);
  addAudit(user.id, user.role, 'login', `Signed in using ${method} from ${getClientIp(req)}`);
  return sendOk(res, {
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      mobile: user.mobile,
      permissions: user.permissions,
    },
    redirectTo:
      user.role === 'student'
        ? '/student'
        : user.role === 'parent'
          ? '/parent'
          : user.role === 'faculty'
            ? '/faculty'
            : '/admin',
  });
});

app.post('/api/auth/request-otp', async (req, res) => {
  const identifier = getBodyString(req.body.identifier);
  const role = getBodyString(req.body.role) as Role;
  const user = await findUserByIdentifier(identifier, role);
  if (!user) {
    return sendError(res, 404, 'No account matches that identifier.');
  }
  const challenge = await createDbOtpChallenge(user.id);
  addAudit(user.id, user.role, 'otp_requested', `OTP requested from ${getClientIp(req)}`);
  return sendOk(res, {
    challengeId: challenge.challengeId,
    expiresInSeconds: 600,
    devCode: challenge.code,
    message: 'Use the dev code in local mode. Replace this with SMS/WhatsApp delivery in production.',
  });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const challengeId = getBodyString(req.body.challengeId);
  const code = getBodyString(req.body.code);
  const user = await verifyOtpChallenge(challengeId, code);
  if (!user) {
    return sendError(res, 400, 'OTP challenge expired or invalid.');
  }
  const session = await createDbSession(user.id);
  addAudit(user.id, user.role, 'login', `OTP verified from ${getClientIp(req)}`);
  return sendOk(res, {
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      mobile: user.mobile,
      permissions: user.permissions,
    },
    redirectTo:
      user.role === 'student'
        ? '/student'
        : user.role === 'parent'
          ? '/parent'
          : user.role === 'faculty'
            ? '/faculty'
            : '/admin',
  });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const identifier = getBodyString(req.body.identifier);
  const user = await findUserByIdentifier(identifier);
  if (!user) return sendError(res, 404, 'No account matches that identifier.');
  const resetToken = await createDbResetToken(user.id);
  addAudit(user.id, user.role, 'password_reset_requested', 'Password reset requested');
  return sendOk(res, {
    resetToken: resetToken.resetToken,
    resetLink: `/reset-password?token=${resetToken.resetToken}`,
    message: 'Use /api/auth/reset-password with the returned token.',
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const resetToken = getBodyString(req.body.resetToken);
  const newPassword = getBodyString(req.body.newPassword);
  const userId = await consumeResetToken(resetToken);
  if (!userId) return sendError(res, 400, 'Reset token expired or invalid.');
  if (!newPassword || newPassword.length < 8) return sendError(res, 400, 'Password must be at least 8 characters.');
  const user = await findUserById(userId);
  if (!user) return sendError(res, 404, 'User no longer exists.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex');
  await updatePassword(userId, salt, hash);
  addAudit(user.id, user.role, 'password_reset_completed', 'Password reset completed');
  return sendOk(res, { message: 'Password updated successfully.' });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  void revokeSession(auth.token);
  addAudit(auth.user.id, auth.user.role, 'logout', 'Signed out');
  return sendOk(res, { message: 'Logged out successfully.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  return sendOk(res, {
    user: {
      id: auth.user.id,
      name: auth.user.name,
      role: auth.user.role,
      email: auth.user.email,
      mobile: auth.user.mobile,
      permissions: auth.user.permissions,
    },
  });
});

app.get('/api/student/dashboard', requireAuth, requireRole('student'), async (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  return sendOk(res, await buildStudentDashboardData(auth.user.id));
});

app.get('/api/student/practice', requireAuth, requireRole('student'), (_req, res) => {
  return sendOk(res, {
    practiceModules,
    recommendedSubjects: ['Physics', 'Chemistry', 'Mathematics'],
  });
});

app.get('/api/student/exam/meta', requireAuth, requireRole('student'), (_req, res) => {
  return sendOk(res, {
    ...examMeta,
    totalQuestions: seedQuestions.length,
  });
});

app.post('/api/exams/:examId/start', requireAuth, requireRole('student'), async (req, res) => {
  const examId = String(req.params.examId ?? '');
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  const order = shuffleDeterministic(
    seedQuestions.map((q) => q.id),
    `${auth.user.id}:${examId}:${examMeta.id}`,
  );
  const session = await startOrResumeAttempt({
    testCode: examId,
    userId: auth.user.id,
    questionOrder: order,
    durationSeconds: examMeta.durationSeconds,
  });
  if (!session) return sendError(res, 404, 'Exam session not found.');
  addAudit(auth.user.id, auth.user.role, 'exam_started', `Started exam ${examId}`);
  return sendOk(res, {
    sessionId: session.sessionId,
    status: session.status,
    currentIndex: session.currentIndex,
    durationSeconds: session.durationSeconds,
    questionOrder: session.questionOrder,
    questions: buildExamQuestionPayload(session.questionOrder),
  });
});

app.get('/api/exams/sessions/:sessionId', requireAuth, requireRole('student'), async (req, res) => {
  const sessionId = String(req.params.sessionId ?? '');
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  const session = await getAttemptSnapshot(sessionId, auth.user.id);
  if (!session) return sendError(res, 404, 'Exam session not found.');
  return sendOk(res, session);
});

app.patch('/api/exams/sessions/:sessionId/answer', requireAuth, requireRole('student'), async (req, res) => {
  const sessionId = String(req.params.sessionId ?? '');
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  const questionId = Number(String(req.body.questionId ?? ''));
  const answer = getBodyString(req.body.answer) as AnswerKey;
  if (!questionId || !['A', 'B', 'C', 'D'].includes(answer)) return sendError(res, 400, 'Invalid answer payload.');
  const updated = await recordAttemptAnswer({
    sessionId,
    userId: auth.user.id,
    questionPublicId: questionId,
    answer,
  });
  if (updated == null) return sendError(res, 409, 'Exam session unavailable or invalid question.');
  addAudit(auth.user.id, auth.user.role, 'exam_answered', `Answered question ${questionId}`);
  return sendOk(res, { sessionId, questionId, answer });
});

app.patch('/api/exams/sessions/:sessionId/clear', requireAuth, requireRole('student'), async (req, res) => {
  const sessionId = String(req.params.sessionId ?? '');
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  const questionId = Number(String(req.body.questionId ?? ''));
  if (!questionId) return sendError(res, 400, 'Invalid question id.');
  const updated = await clearAttemptAnswer({
    sessionId,
    userId: auth.user.id,
    questionPublicId: questionId,
  });
  if (updated == null) return sendError(res, 409, 'Exam session unavailable or invalid question.');
  addAudit(auth.user.id, auth.user.role, 'exam_cleared', `Cleared question ${questionId}`);
  return sendOk(res, { sessionId, questionId });
});

app.patch('/api/exams/sessions/:sessionId/mark', requireAuth, requireRole('student'), async (req, res) => {
  const sessionId = String(req.params.sessionId ?? '');
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  const questionId = Number(String(req.body.questionId ?? ''));
  const marked = Boolean(req.body.marked);
  if (!questionId) return sendError(res, 400, 'Invalid question id.');
  const updated = await markAttemptQuestion({
    sessionId,
    userId: auth.user.id,
    questionPublicId: questionId,
    marked,
  });
  if (updated == null) return sendError(res, 409, 'Exam session unavailable or invalid question.');
  addAudit(auth.user.id, auth.user.role, 'exam_mark_review', `${marked ? 'Marked' : 'Unmarked'} question ${questionId}`);
  return sendOk(res, { sessionId, questionId, marked });
});

app.post('/api/exams/sessions/:sessionId/submit', requireAuth, requireRole('student'), async (req, res) => {
  const sessionId = String(req.params.sessionId ?? '');
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  const result = await submitAttempt({
    sessionId,
    userId: auth.user.id,
    answers: req.body.answers as Record<string, AnswerKey> | undefined,
  });
  if (!result) return sendError(res, 409, 'Exam session already submitted, expired, or invalid.');
  addAudit(auth.user.id, auth.user.role, 'exam_submitted', `Submitted exam ${result.examId}`);
  addNotification('Exam submitted', `Your result for ${result.examId} is ready.`, 'student');
  return sendOk(res, result);
});

app.get('/api/student/analysis/latest', requireAuth, requireRole('student'), async (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  return sendOk(res, await buildAnalysisFromSubmission(auth.user.id));
});

app.get('/api/student/insights', requireAuth, requireRole('student'), async (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  return sendOk(res, await buildStudentInsights(auth.user.id));
});

app.get('/api/student/leaderboard', requireAuth, requireRole('student'), async (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  return sendOk(res, await buildLeaderboardForUser(auth.user.id));
});

app.get('/api/parent/dashboard', requireAuth, requireRole('parent'), async (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  return sendOk(res, await buildParentDashboard(auth.user.id));
});

app.get('/api/faculty/dashboard', requireAuth, requireRole('faculty'), async (_req, res) => {
  return sendOk(res, await buildFacultyDashboard());
});

app.get('/api/faculty/question-bank', requireAuth, requireRole('faculty'), async (_req, res) => {
  return sendOk(res, buildFacultyQuestionBank());
});

app.get('/api/admin/dashboard', requireAuth, requireRole('admin'), async (_req, res) => {
  return sendOk(res, await getAdminDashboardData());
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  const search = String(req.query.search ?? '');
  const tab = String(req.query.tab ?? 'All');
  return sendOk(res, await listAdminUsers(search, tab));
});

app.get('/api/admin/institutes', requireAuth, requireRole('admin'), async (req, res) => {
  const region = String(req.query.region ?? 'All');
  const plan = String(req.query.plan ?? 'All');
  return sendOk(res, await listAdminInstitutes(region, plan));
});

app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), async (_req, res) => {
  return sendOk(res, { auditLogs: await listAuditLogs() });
});

app.get('/api/admin/notifications', requireAuth, requireRole('admin'), async (_req, res) => {
  return sendOk(res, { notifications: await listNotifications() });
});

app.post('/api/admin/reports/weekly', requireAuth, requireRole('admin'), async (_req, res) => {
  const reports = await buildWeeklyReports();
  await queueWeeklyReportNotifications();
  return sendOk(res, {
    count: reports.length,
    reports,
    message: 'Weekly reports generated and queued for in-app delivery.',
  });
});

app.get('/api/reports/weekly', requireAuth, async (req, res) => {
  const auth = (req as Request & { auth?: RequestAuth }).auth!;
  const reports = await buildWeeklyReports();
  const report = reports.find((item) => item.userId === auth.user.id || item.role === auth.user.role);
  if (!report) return sendError(res, 404, 'Weekly report not found.');
  return sendOk(res, report);
});

app.get('/api/reference/roles', async (_req, res) => {
  return sendOk(res, {
    roles: await listReferenceRoles(),
  });
});

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  return res.sendFile(path.join(distDir, 'index.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return sendError(res, 404, 'Route not found.');
  }
  return res.status(404).send('Not found');
});

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
app.listen(port, () => {
  console.log(`PrepMind app listening on http://localhost:${port}`);
});
