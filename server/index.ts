import crypto from 'node:crypto';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import {
  analysis as staticAnalysis,
  aiRecommendations,
  dashboardMetrics,
  examMeta,
  heatmapCells,
  insightsProfile,
  leaderboard as staticLeaderboard,
  practiceModules,
  revisionPriorities,
  subjectPerformance,
  weeklyProgress,
  weakAreas,
} from '../src/mocks/student';
import {
  adminMetrics,
  facultyAlerts,
  facultyMetrics,
  facultyStudents,
  facultyTrend,
  healthLogs,
  instituteMetrics,
  institutes,
  parentActivity,
  parentGrowth,
  parentMastery,
  parentMetrics,
  parentReports,
  questionBankRows,
  questionDifficulty,
  topInstitutions,
  userMetrics,
  users,
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
  sessions: Map<string, AuthSession>;
  otpChallenges: Map<string, OtpChallenge>;
  passwordResets: Map<string, ResetToken>;
  examSessions: Map<string, ExamSession>;
  latestResults: Map<string, SubmissionResult>;
  auditLogs: AuditLog[];
  notifications: Array<{ id: string; title: string; body: string; createdAt: string; role?: Role }>;
  rateLimit: Map<string, { count: number; resetAt: number }>;
}

const state: AppState = {
  sessions: new Map(),
  otpChallenges: new Map(),
  passwordResets: new Map(),
  examSessions: new Map(),
  latestResults: new Map(),
  auditLogs: [],
  notifications: [],
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

function sendOk<T extends Record<string, unknown>>(res: Response, data: T) {
  return res.json({ ok: true, data });
}

function addAudit(actorId: string, actorRole: Role, action: string, detail: string, severity: AuditLog['severity'] = 'info') {
  state.auditLogs.unshift({
    id: createToken('audit'),
    timestamp: new Date().toISOString(),
    actorId,
    actorRole,
    action,
    detail,
    severity,
  });
  state.auditLogs = state.auditLogs.slice(0, 200);
}

function addNotification(title: string, body: string, role?: Role) {
  state.notifications.unshift({
    id: createToken('note'),
    title,
    body,
    role,
    createdAt: new Date().toISOString(),
  });
  state.notifications = state.notifications.slice(0, 100);
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

function findUserByIdentifier(identifier: string, role?: Role) {
  const normalized = identifier.trim().toLowerCase();
  return demoAccounts.find((user) => {
    const roleMatches = role ? user.role === role : true;
    return roleMatches && [user.email, user.mobile, user.name].some((value) => value.toLowerCase() === normalized);
  });
}

function getUserById(id: string) {
  return demoAccounts.find((user) => user.id === id);
}

function getRoleFromRequest(req: Request) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const session = state.sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= now()) {
    state.sessions.delete(token);
    return null;
  }
  const user = getUserById(session.userId);
  if (!user) return null;
  return { session, user, token };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getRoleFromRequest(req);
  if (!auth) return sendError(res, 401, 'Authentication required.');
  (req as Request & { auth?: typeof auth }).auth = auth;
  return next();
}

function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth;
    if (!auth) return sendError(res, 401, 'Authentication required.');
    if (!roles.includes(auth.user.role)) return sendError(res, 403, 'Insufficient permissions.');
    return next();
  };
}

function getBodyString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function createSession(user: DemoAccount) {
  const token = createToken('sess');
  const session: AuthSession = {
    token,
    userId: user.id,
    role: user.role,
    createdAt: now(),
    expiresAt: now() + 1000 * 60 * 60 * 24 * 7,
  };
  state.sessions.set(token, session);
  return session;
}

function createOtpChallenge(user: DemoAccount) {
  const challenge: OtpChallenge = {
    challengeId: createToken('otp'),
    userId: user.id,
    role: user.role,
    code: String(100000 + Math.floor(Math.random() * 900000)),
    expiresAt: now() + 1000 * 60 * 10,
  };
  state.otpChallenges.set(challenge.challengeId, challenge);
  return challenge;
}

function createResetToken(user: DemoAccount) {
  const token = createToken('reset');
  state.passwordResets.set(token, {
    token,
    userId: user.id,
    expiresAt: now() + 1000 * 60 * 30,
  });
  return token;
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

function getLatestSubmission(userId: string) {
  return state.latestResults.get(userId) ?? null;
}

function buildAnalysisFromSubmission(userId: string) {
  const latest = getLatestSubmission(userId);
  if (!latest) {
    return staticAnalysis;
  }
  return {
    ...staticAnalysis,
    totalScore: latest.score,
    totalPossible: latest.totalPossible,
    totalPct: latest.accuracyPct,
    rank: latest.rank,
    rankPercentile: latest.percentRank,
    accuracyPct: latest.accuracyPct,
    correctCount: latest.correctCount,
    incorrectCount: latest.incorrectCount,
    skippedCount: latest.skippedCount,
    topicPerformance: latest.topicPerformance,
  };
}

function computeSubmission(session: ExamSession): SubmissionResult {
  const questionsById = new Map(seedQuestions.map((q) => [q.id, q]));
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  for (const question of seedQuestions) {
    const answer = session.answers[question.id];
    if (!answer) {
      skippedCount += 1;
      continue;
    }
    if (answer === questionsById.get(question.id)?.correctKey) {
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }
  }

  const totalPossible = seedQuestions.length * 4;
  const score = correctCount * 4 - incorrectCount;
  const accuracyPct = Math.round((correctCount / seedQuestions.length) * 100);

  return {
    sessionId: session.sessionId,
    examId: session.examId,
    score,
    totalScore: score,
    totalPossible,
    accuracyPct,
    correctCount,
    incorrectCount,
    skippedCount,
    topicPerformance: staticAnalysis.topicPerformance,
    rank: Math.max(1, staticAnalysis.rank - Math.floor(correctCount / 10)),
    percentRank: Math.max(1, staticAnalysis.rankPercentile - Math.floor(correctCount / 20)),
  };
}

function buildLeaderboardForUser(userId: string) {
  const latest = getLatestSubmission(userId);
  if (!latest) return staticLeaderboard;
  const userName = getUserById(userId)?.name ?? 'You';
  return {
    ...staticLeaderboard,
    userPerformance: {
      ...staticLeaderboard.userPerformance,
      rank: latest.rank,
      masteryPct: latest.accuracyPct,
      percentile: `Top ${latest.percentRank}% in your batch`,
    },
    batch: staticLeaderboard.batch.map((row) =>
      row.isCurrentUser
        ? { ...row, points: latest.score, deltaPct: 0, name: `You (${userName})` }
        : row,
    ),
    subject: staticLeaderboard.subject.map((row) =>
      row.isCurrentUser ? { ...row, accuracy: latest.accuracyPct, name: 'You' } : row,
    ),
  };
}

function getClientIp(req: Request) {
  return String(req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', rateLimit(60_000, 20));
app.use('/api', rateLimit(60_000, 120));

app.get('/api/health', (_req, res) => {
  sendOk(res, {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    activeSessions: state.sessions.size,
    activeExamSessions: state.examSessions.size,
  });
});

app.post('/api/auth/login', (req, res) => {
  const identifier = getBodyString(req.body.identifier);
  const password = getBodyString(req.body.password);
  const role = getBodyString(req.body.role) as Role;
  const method = getBodyString(req.body.method) as 'email' | 'mobile' | 'otp';

  if (!identifier || !role) {
    return sendError(res, 400, 'Identifier and role are required.');
  }

  const user = findUserByIdentifier(identifier, role);
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

  const session = createSession(user);
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

app.post('/api/auth/request-otp', (req, res) => {
  const identifier = getBodyString(req.body.identifier);
  const role = getBodyString(req.body.role) as Role;
  const user = findUserByIdentifier(identifier, role);
  if (!user) {
    return sendError(res, 404, 'No account matches that identifier.');
  }
  const challenge = createOtpChallenge(user);
  addAudit(user.id, user.role, 'otp_requested', `OTP requested from ${getClientIp(req)}`);
  return sendOk(res, {
    challengeId: challenge.challengeId,
    expiresInSeconds: 600,
    devCode: challenge.code,
    message: 'Use the dev code in local mode. Replace this with SMS/WhatsApp delivery in production.',
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const challengeId = getBodyString(req.body.challengeId);
  const code = getBodyString(req.body.code);
  const challenge = state.otpChallenges.get(challengeId);
  if (!challenge || challenge.expiresAt <= now()) {
    return sendError(res, 400, 'OTP challenge expired or invalid.');
  }
  if (challenge.code !== code) {
    addAudit(challenge.userId, challenge.role, 'otp_failed', `Invalid OTP from ${getClientIp(req)}`, 'warning');
    return sendError(res, 401, 'Invalid OTP code.');
  }
  const user = getUserById(challenge.userId);
  if (!user) return sendError(res, 404, 'User no longer exists.');
  const session = createSession(user);
  state.otpChallenges.delete(challengeId);
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

app.post('/api/auth/forgot-password', (req, res) => {
  const identifier = getBodyString(req.body.identifier);
  const user = findUserByIdentifier(identifier);
  if (!user) return sendError(res, 404, 'No account matches that identifier.');
  const resetToken = createResetToken(user);
  addAudit(user.id, user.role, 'password_reset_requested', 'Password reset requested');
  return sendOk(res, {
    resetToken,
    resetLink: `/reset-password?token=${resetToken}`,
    message: 'Use /api/auth/reset-password with the returned token.',
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const resetToken = getBodyString(req.body.resetToken);
  const newPassword = getBodyString(req.body.newPassword);
  const record = state.passwordResets.get(resetToken);
  if (!record || record.expiresAt <= now()) return sendError(res, 400, 'Reset token expired or invalid.');
  if (!newPassword || newPassword.length < 8) return sendError(res, 400, 'Password must be at least 8 characters.');
  const user = getUserById(record.userId);
  if (!user) return sendError(res, 404, 'User no longer exists.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex');
  user.passwordSalt = salt;
  user.passwordHash = hash;
  state.passwordResets.delete(resetToken);
  addAudit(user.id, user.role, 'password_reset_completed', 'Password reset completed');
  return sendOk(res, { message: 'Password updated successfully.' });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  state.sessions.delete(auth.token);
  addAudit(auth.user.id, auth.user.role, 'logout', 'Signed out');
  return sendOk(res, { message: 'Logged out successfully.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
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

app.get('/api/student/dashboard', requireAuth, requireRole('student'), (_req, res) => {
  return sendOk(res, {
    currentStudent: seed.currentStudent,
    metrics: dashboardMetrics,
    weeklyProgress,
    subjectPerformance,
    heatmapCells,
    weakAreas,
    aiRecommendations,
  });
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

app.post('/api/exams/:examId/start', requireAuth, requireRole('student'), (req, res) => {
  const { examId } = req.params;
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  const existing = Array.from(state.examSessions.values()).find(
    (session) => session.examId === examId && session.userId === auth.user.id && session.status === 'active',
  );
  if (existing) {
    return sendOk(res, {
      sessionId: existing.sessionId,
      status: existing.status,
      currentIndex: existing.currentIndex,
      durationSeconds: existing.durationSeconds,
      questionOrder: existing.questionOrder,
      questions: buildExamQuestionPayload(existing.questionOrder),
    });
  }

  const order = shuffleDeterministic(
    seedQuestions.map((q) => q.id),
    `${auth.user.id}:${examId}:${examMeta.id}`,
  );
  const session: ExamSession = {
    sessionId: createToken('exam'),
    examId,
    userId: auth.user.id,
    role: auth.user.role,
    status: 'active',
    questionOrder: order,
    answers: {},
    marked: [],
    currentIndex: examMeta.currentIndex,
    startedAt: now(),
    durationSeconds: examMeta.durationSeconds,
  };
  state.examSessions.set(session.sessionId, session);
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

app.get('/api/exams/sessions/:sessionId', requireAuth, requireRole('student'), (req, res) => {
  const session = state.examSessions.get(req.params.sessionId);
  if (!session) return sendError(res, 404, 'Exam session not found.');
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  if (session.userId !== auth.user.id) return sendError(res, 403, 'You do not own this session.');
  return sendOk(res, {
    sessionId: session.sessionId,
    status: session.status,
    currentIndex: session.currentIndex,
    answers: session.answers,
    marked: session.marked,
    startedAt: session.startedAt,
    durationSeconds: session.durationSeconds,
  });
});

app.patch('/api/exams/sessions/:sessionId/answer', requireAuth, requireRole('student'), (req, res) => {
  const session = state.examSessions.get(req.params.sessionId);
  if (!session) return sendError(res, 404, 'Exam session not found.');
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  if (session.userId !== auth.user.id) return sendError(res, 403, 'You do not own this session.');
  if (session.status !== 'active') return sendError(res, 409, 'Exam session already submitted.');
  const questionId = Number(req.body.questionId);
  const answer = getBodyString(req.body.answer) as AnswerKey;
  if (!questionId || !['A', 'B', 'C', 'D'].includes(answer)) return sendError(res, 400, 'Invalid answer payload.');
  session.answers[questionId] = answer;
  session.currentIndex = questionId;
  addAudit(auth.user.id, auth.user.role, 'exam_answered', `Answered question ${questionId}`);
  return sendOk(res, { sessionId: session.sessionId, questionId, answer });
});

app.patch('/api/exams/sessions/:sessionId/clear', requireAuth, requireRole('student'), (req, res) => {
  const session = state.examSessions.get(req.params.sessionId);
  if (!session) return sendError(res, 404, 'Exam session not found.');
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  const questionId = Number(req.body.questionId);
  delete session.answers[questionId];
  addAudit(auth.user.id, auth.user.role, 'exam_cleared', `Cleared question ${questionId}`);
  return sendOk(res, { sessionId: session.sessionId, questionId });
});

app.patch('/api/exams/sessions/:sessionId/mark', requireAuth, requireRole('student'), (req, res) => {
  const session = state.examSessions.get(req.params.sessionId);
  if (!session) return sendError(res, 404, 'Exam session not found.');
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  if (session.userId !== auth.user.id) return sendError(res, 403, 'You do not own this session.');
  const questionId = Number(req.body.questionId);
  const marked = Boolean(req.body.marked);
  if (marked && !session.marked.includes(questionId)) session.marked.push(questionId);
  if (!marked) session.marked = session.marked.filter((id) => id !== questionId);
  addAudit(auth.user.id, auth.user.role, 'exam_mark_review', `${marked ? 'Marked' : 'Unmarked'} question ${questionId}`);
  return sendOk(res, { sessionId: session.sessionId, questionId, marked });
});

app.post('/api/exams/sessions/:sessionId/submit', requireAuth, requireRole('student'), (req, res) => {
  const session = state.examSessions.get(req.params.sessionId);
  if (!session) return sendError(res, 404, 'Exam session not found.');
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  if (session.userId !== auth.user.id) return sendError(res, 403, 'You do not own this session.');
  if (session.status === 'submitted') return sendError(res, 409, 'Exam session already submitted.');
  if (session.startedAt + session.durationSeconds * 1000 + 2 * 60 * 1000 < now()) {
    addAudit(auth.user.id, auth.user.role, 'submit_after_timeout', 'Submission after expiry', 'warning');
    return sendError(res, 409, 'Exam session expired.');
  }

  const overrideAnswers = req.body.answers as Record<string, AnswerKey> | undefined;
  if (overrideAnswers && typeof overrideAnswers === 'object') {
    for (const [questionId, answer] of Object.entries(overrideAnswers)) {
      if (['A', 'B', 'C', 'D'].includes(answer)) {
        session.answers[Number(questionId)] = answer;
      }
    }
  }

  session.status = 'submitted';
  session.submittedAt = now();
  const result = computeSubmission(session);
  state.latestResults.set(auth.user.id, result);
  addAudit(auth.user.id, auth.user.role, 'exam_submitted', `Submitted exam ${session.examId}`);
  addNotification('Exam submitted', `Your result for ${session.examId} is ready.`, 'student');
  return sendOk(res, result);
});

app.get('/api/student/analysis/latest', requireAuth, requireRole('student'), (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  return sendOk(res, buildAnalysisFromSubmission(auth.user.id));
});

app.get('/api/student/insights', requireAuth, requireRole('student'), (_req, res) => {
  return sendOk(res, {
    insightsProfile,
    revisionPriorities,
    knowledgeGapHeatmap: genInsightsHeatmap(72),
  });
});

app.get('/api/student/leaderboard', requireAuth, requireRole('student'), (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof getRoleFromRequest> }).auth!;
  return sendOk(res, buildLeaderboardForUser(auth.user.id));
});

app.get('/api/parent/dashboard', requireAuth, requireRole('parent'), (_req, res) => {
  return sendOk(res, {
    metrics: parentMetrics,
    growth: parentGrowth,
    mastery: parentMastery,
    reports: parentReports,
    activity: parentActivity,
    latestPrediction: 94.5,
  });
});

app.get('/api/faculty/dashboard', requireAuth, requireRole('faculty'), (_req, res) => {
  return sendOk(res, {
    metrics: facultyMetrics,
    trend: facultyTrend,
    alerts: facultyAlerts,
    students: facultyStudents,
    curriculumGap: {
      headline: '64% of students are struggling with Asymptotic Complexity.',
      focusAreas: ['Algebra', 'Complexity', 'Probability'],
    },
  });
});

app.get('/api/faculty/question-bank', requireAuth, requireRole('faculty'), (_req, res) => {
  return sendOk(res, {
    questionBankRows,
    questionDifficulty,
    suggestedMergeNote:
      'The system suggests merging two repeated vectors questions from last month to reduce overlap.',
  });
});

app.get('/api/admin/dashboard', requireAuth, requireRole('admin'), (_req, res) => {
  return sendOk(res, {
    metrics: adminMetrics,
    heatmap: heatmapCells,
    topInstitutions,
    healthLogs,
    securityNotes: ['SOC2 Compliant', '99.9% Uptime', 'Encrypted Multi-Tenancy'],
  });
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const search = String(req.query.search ?? '').toLowerCase();
  const tab = String(req.query.tab ?? 'All');
  const filtered = userDirectory.filter((user) => {
    const matchesTab =
      tab === 'All' ||
      (tab === 'Students' && user.role === 'student') ||
      (tab === 'Faculty' && user.role === 'faculty') ||
      (tab === 'Administrators' && user.role === 'admin');
    const matchesSearch = `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(search);
    return matchesTab && matchesSearch;
  });
  return sendOk(res, {
    metrics: userMetrics,
    users: filtered,
    total: filtered.length,
    aiUsageInsights: [
      { label: 'Student logins', percent: 86 },
      { label: 'Faculty activity', percent: 72 },
      { label: 'Admin operations', percent: 54 },
      { label: 'Parent check-ins', percent: 41 },
    ],
  });
});

app.get('/api/admin/institutes', requireAuth, requireRole('admin'), (req, res) => {
  const region = String(req.query.region ?? 'All');
  const plan = String(req.query.plan ?? 'All');
  const filtered = institutes.filter((item) => {
    const matchesRegion = region === 'All' || item.region === region;
    const matchesPlan = plan === 'All' || item.plan === plan;
    return matchesRegion && matchesPlan;
  });
  return sendOk(res, {
    metrics: instituteMetrics,
    institutes: filtered,
    regionalPerformanceHeatmap: genInsightsHeatmap(35).slice(0, 35),
    optimizationTip:
      'Asia-Pacific institutes are showing a 15% uplift in STEM enrollments after shifting morning mock slots.',
  });
});

app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), (_req, res) => {
  return sendOk(res, { auditLogs: state.auditLogs });
});

app.get('/api/admin/notifications', requireAuth, requireRole('admin'), (_req, res) => {
  return sendOk(res, { notifications: state.notifications });
});

app.get('/api/reference/roles', (_req, res) => {
  return sendOk(res, {
    roles: [
      { key: 'student', permissions: rolePermissions.student },
      { key: 'parent', permissions: rolePermissions.parent },
      { key: 'faculty', permissions: rolePermissions.faculty },
      { key: 'admin', permissions: rolePermissions.admin },
    ],
  });
});

app.use((_req, res) => {
  sendError(res, 404, 'Route not found.');
});

const port = Number(process.env.API_PORT ?? 8787);
app.listen(port, () => {
  console.log(`PrepMind API listening on http://localhost:${port}`);
});
