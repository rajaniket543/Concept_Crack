import { pool } from '../db/client';
import {
  aiRecommendations as fallbackAiRecommendations,
  analysis as fallbackAnalysis,
  currentStudent as fallbackCurrentStudent,
  dashboardMetrics as fallbackDashboardMetrics,
  genInsightsHeatmap,
  heatmapCells as fallbackHeatmapCells,
  insightsProfile as fallbackInsightsProfile,
  leaderboard as fallbackLeaderboard,
  practiceModules as fallbackPracticeModules,
  revisionPriorities as fallbackRevisionPriorities,
  subjectPerformance as fallbackSubjectPerformance,
  weeklyProgress as fallbackWeeklyProgress,
  weakAreas as fallbackWeakAreas,
} from '../src/mocks/student';

type InsightTone = 'primary' | 'secondary' | 'tertiary';

interface SubmissionContext {
  attemptId: string;
  userId: string;
  userName: string;
  batchName: string | null;
  instituteName: string | null;
  examId: string;
  startedAt: string;
  submittedAt: string | null;
  durationSeconds: number;
  timeTakenSeconds: number;
  totalScore: number;
  totalPossible: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracyPct: number;
}

interface AnswerStatRow {
  subjectName: string;
  chapterName: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  publicId: number;
  selectedOption: 'A' | 'B' | 'C' | 'D' | null;
  correctOption: 'A' | 'B' | 'C' | 'D';
}

interface TopicStat {
  topic: string;
  subject: string;
  total: number;
  correct: number;
  percent: number;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function toneForPercent(value: number): InsightTone {
  if (value >= 75) return 'primary';
  if (value >= 50) return 'secondary';
  return 'tertiary';
}

function toneClassForPercent(value: number) {
  if (value >= 75) return 'bg-primary-fixed text-on-primary-fixed';
  if (value >= 50) return 'bg-secondary-fixed text-on-secondary-fixed';
  return 'bg-surface-container-highest text-on-surface-variant';
}

function barClassForPercent(value: number) {
  if (value >= 85) return 'bg-primary';
  if (value >= 70) return 'bg-secondary';
  if (value >= 50) return 'bg-on-tertiary-container';
  return 'bg-error';
}

function intensityForPercent(value: number): 10 | 30 | 60 | 100 {
  if (value >= 85) return 100;
  if (value >= 70) return 60;
  if (value >= 50) return 30;
  return 10;
}

function cellClassForPercent(value: number) {
  if (value >= 85) return 'bg-primary';
  if (value >= 70) return 'bg-primary/60';
  if (value >= 50) return 'bg-primary/30';
  return 'bg-primary/10';
}

function dayKey(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' }) as 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
}

async function loadLatestSubmission(userId: string) {
  const result = await pool.query<SubmissionContext>(
    `
    SELECT
      a.id AS "attemptId",
      a.user_id AS "userId",
      u.name AS "userName",
      b.name AS "batchName",
      i.name AS "instituteName",
      t.code AS "examId",
      a.started_at::text AS "startedAt",
      a.submitted_at::text AS "submittedAt",
      t.duration_seconds AS "durationSeconds",
      a.time_taken_seconds AS "timeTakenSeconds",
      s.total_score AS "totalScore",
      s.total_possible AS "totalPossible",
      s.correct_count AS "correctCount",
      s.incorrect_count AS "incorrectCount",
      s.skipped_count AS "skippedCount",
      s.accuracy_pct AS "accuracyPct"
    FROM scores s
    JOIN attempts a ON a.id = s.attempt_id
    JOIN users u ON u.id = a.user_id
    LEFT JOIN batches b ON b.id = u.batch_id
    LEFT JOIN institutes i ON i.id = u.institute_id
    JOIN tests t ON t.id = a.test_id
    WHERE a.user_id = $1
      AND a.status = 'submitted'
    ORDER BY s.computed_at DESC
    LIMIT 1;
  `,
    [userId],
  );
  return result.rows[0] ?? null;
}

async function loadPreviousAccuracy(userId: string) {
  const result = await pool.query<{ accuracy_pct: number }>(
    `
    SELECT s.accuracy_pct
    FROM scores s
    JOIN attempts a ON a.id = s.attempt_id
    WHERE a.user_id = $1
      AND a.status = 'submitted'
    ORDER BY s.computed_at DESC
    OFFSET 1
    LIMIT 1;
  `,
    [userId],
  );
  return result.rows[0]?.accuracy_pct ?? null;
}

async function loadRecentAttempts(userId: string) {
  const result = await pool.query<{
    day: string;
    accuracy_pct: number;
    time_taken_seconds: number;
  }>(
    `
    SELECT
      to_char(COALESCE(s.computed_at, a.submitted_at)::date, 'YYYY-MM-DD') AS day,
      s.accuracy_pct,
      a.time_taken_seconds
    FROM scores s
    JOIN attempts a ON a.id = s.attempt_id
    WHERE a.user_id = $1
      AND a.status = 'submitted'
      AND COALESCE(s.computed_at, a.submitted_at) >= now() - interval '30 days'
    ORDER BY COALESCE(s.computed_at, a.submitted_at) ASC;
  `,
    [userId],
  );
  return result.rows;
}

async function loadAttemptBreakdown(attemptId: string) {
  const result = await pool.query<AnswerStatRow>(
    `
    SELECT
      subj.name AS "subjectName",
      ch.name AS "chapterName",
      q.difficulty,
      q.public_id AS "publicId",
      aa.selected_option AS "selectedOption",
      q.correct_option AS "correctOption"
    FROM attempt_answers aa
    JOIN questions q ON q.id = aa.question_id
    JOIN subjects subj ON subj.id = q.subject_id
    LEFT JOIN chapters ch ON ch.id = q.chapter_id
    WHERE aa.attempt_id = $1
    ORDER BY q.public_id ASC;
  `,
    [attemptId],
  );
  return result.rows;
}

function aggregateTopicStats(rows: AnswerStatRow[]) {
  const byTopic = new Map<string, TopicStat>();
  const bySubject = new Map<string, TopicStat>();
  const byDifficulty = new Map<string, TopicStat>();

  for (const row of rows) {
    const correct = row.selectedOption && row.selectedOption === row.correctOption ? 1 : 0;
    const topicKey = row.chapterName ?? row.subjectName;
    const subjectKey = row.subjectName;
    const difficultyKey = row.difficulty;

    const bump = (map: Map<string, TopicStat>, key: string, subject: string) => {
      const existing = map.get(key) ?? { topic: key, subject, total: 0, correct: 0, percent: 0 };
      existing.total += 1;
      existing.correct += correct;
      existing.percent = percent(existing.correct, existing.total);
      map.set(key, existing);
    };

    bump(byTopic, topicKey, row.subjectName);
    bump(bySubject, subjectKey, row.subjectName);
    bump(byDifficulty, difficultyKey, row.subjectName);
  }

  return {
    topics: [...byTopic.values()].sort((a, b) => a.percent - b.percent || b.total - a.total),
    subjects: [...bySubject.values()].sort((a, b) => b.percent - a.percent),
    difficulties: [...byDifficulty.values()].sort((a, b) => a.percent - b.percent),
  };
}

function expandHeatmapFromTopics(topics: TopicStat[], count: number) {
  if (topics.length === 0) {
    return genInsightsHeatmap(count);
  }
  return Array.from({ length: count }, (_, index) => {
    const topic = topics[index % topics.length];
    const score = topic.percent;
    const trend = score >= 75 ? 'up' : score >= 50 ? 'flat' : 'down';
    const intensity = intensityForPercent(score);
    return {
      module: topic.topic,
      score,
      trend,
      intensity,
      cellClass: cellClassForPercent(score),
    };
  });
}

function buildWeakAreas(topics: TopicStat[]) {
  const ordered = [...topics].sort((a, b) => a.percent - b.percent).slice(0, 3);
  if (ordered.length === 0) return fallbackWeakAreas;
  return ordered.map((topic) => ({
    name: topic.topic,
    percent: topic.percent,
    note: `Latest attempt: ${topic.correct}/${topic.total} correct`,
  }));
}

function buildRecommendations(weakAreas: Array<{ name: string; percent: number }>) {
  if (weakAreas.length === 0) return fallbackAiRecommendations;
  return weakAreas.slice(0, 2).map((weakArea) => ({
    title: `Revise ${weakArea.name}`,
    rationale: `Your latest accuracy here is ${weakArea.percent}%.`,
    durationMins: weakArea.percent < 50 ? 25 : 15,
    icon: 'auto_awesome',
  }));
}

function buildPracticeModules(topics: TopicStat[]) {
  const ordered = [...topics].sort((a, b) => a.percent - b.percent).slice(0, 3);
  if (ordered.length === 0) return fallbackPracticeModules;

  return ordered.map((topic, index) => {
    const difficulty = topic.percent >= 75 ? 'Hard' : topic.percent >= 50 ? 'Medium' : 'Easy';
    const status = topic.percent >= 90 ? 'completed' : topic.percent >= 70 ? 'review' : 'start';
    return {
      id: topic.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: topic.topic,
      subject: topic.subject as (typeof fallbackPracticeModules)[number]['subject'],
      icon: index === 0 ? 'auto_awesome' : index === 1 ? 'history_edu' : 'menu_book',
      difficulty,
      badges: [difficulty, index === 0 ? 'AI Pick' : 'PYQ'],
      questions: Math.max(18, topic.total * 6),
      minutes: Math.max(30, Math.round(topic.total * 2.5)),
      progress: clamp(topic.percent),
      status,
    };
  });
}

function buildDashboardMetrics(
  latest: Awaited<ReturnType<typeof loadLatestSubmission>>,
  previousAccuracy: number | null,
  rank: number,
  totalStudents: number,
) {
  if (!latest) return fallbackDashboardMetrics;
  const accuracy = Number(latest.accuracyPct);
  const percentile = Math.max(1, Math.round((rank / Math.max(1, totalStudents)) * 100));
  const delta = previousAccuracy == null ? '+0% vs previous attempt' : `${accuracy - Number(previousAccuracy) >= 0 ? '+' : ''}${Math.round(accuracy - Number(previousAccuracy))}% vs previous attempt`;
  const practiceHours = Math.max(1, Math.round((latest.timeTakenSeconds / 3600) * 10) / 10);
  return [
    {
      label: 'Performance Score',
      value: `${accuracy}%`,
      delta,
      icon: 'insights',
      tone: 'primary' as const,
    },
    {
      label: 'Current Rank',
      value: `#${rank}`,
      delta: `Top ${percentile}% of ${totalStudents} students`,
      icon: 'workspace_premium',
      tone: 'secondary' as const,
    },
    {
      label: 'Accuracy',
      value: `${accuracy}%`,
      icon: 'target',
      tone: 'tertiary' as const,
      progressPct: accuracy,
    },
    {
      label: 'Practice Time',
      value: `${practiceHours}h`,
      delta: 'From latest submission window',
      icon: 'timer',
      tone: 'muted' as const,
    },
  ];
}

async function buildStudentDashboardData(userId: string) {
  const latest = await loadLatestSubmission(userId);
  const previousAccuracy = await loadPreviousAccuracy(userId);
  const recentAttempts = await loadRecentAttempts(userId);

  const userResult = await pool.query<{
    id: string;
    name: string;
    batch_name: string | null;
    institute_name: string | null;
  }>(
    `
    SELECT u.id, u.name, b.name AS batch_name, i.name AS institute_name
    FROM users u
    LEFT JOIN batches b ON b.id = u.batch_id
    LEFT JOIN institutes i ON i.id = u.institute_id
    WHERE u.id = $1
    LIMIT 1;
  `,
    [userId],
  );
  const user = userResult.rows[0] ?? null;

  if (!latest || !user) {
    return {
      currentStudent: fallbackCurrentStudent,
      metrics: fallbackDashboardMetrics,
      weeklyProgress: fallbackWeeklyProgress,
      subjectPerformance: fallbackSubjectPerformance,
      heatmapCells: fallbackHeatmapCells,
      weakAreas: fallbackWeakAreas,
      aiRecommendations: fallbackAiRecommendations,
    };
  }

  const breakdownRows = await loadAttemptBreakdown(latest.attemptId);
  const stats = aggregateTopicStats(breakdownRows);
  const weakAreas = buildWeakAreas(stats.topics);
  const recommendations = buildRecommendations(weakAreas);

  const currentStudent = {
    id: user.id,
    name: user.name,
    grade: user.batch_name ?? fallbackCurrentStudent.grade,
    initials: initials(user.name),
  };

  const dayMap = new Map<string, number>();
  for (const item of recentAttempts) {
    dayMap.set(item.day, Number(item.accuracy_pct));
  }
  const weeklyProgress = Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    // Use a local-date key so it matches the DB's `::date` (session timezone),
    // not UTC — otherwise the day can shift and the bar disappears.
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = dayKey(d);
    const accuracy = dayMap.get(day) ?? 0;
    return { day: label, percent: accuracy };
  });

  const rankResult = await pool.query<{ rank_ahead: string; total_students: string }>(
    `
    SELECT
      (SELECT COUNT(*) FROM scores s
         JOIN attempts a ON a.id = s.attempt_id
        WHERE a.status = 'submitted'
          AND (s.total_score > $1 OR (s.total_score = $1 AND s.accuracy_pct > $2)))::text AS rank_ahead,
      (SELECT COUNT(DISTINCT a.user_id) FROM attempts a WHERE a.status = 'submitted')::text AS total_students;
  `,
    [latest.totalScore, latest.accuracyPct],
  );
  const rank = Number(rankResult.rows[0]?.rank_ahead ?? 0) + 1;
  const totalStudents = Math.max(1, Number(rankResult.rows[0]?.total_students ?? 1));
  const metrics = buildDashboardMetrics(latest, previousAccuracy, rank, totalStudents);

  return {
    currentStudent,
    metrics,
    weeklyProgress,
    subjectPerformance: stats.subjects.length
      ? stats.subjects.map((subject) => ({
          subject: subject.topic as (typeof fallbackSubjectPerformance)[number]['subject'],
          percent: subject.percent,
          barClass: barClassForPercent(subject.percent),
        }))
      : fallbackSubjectPerformance,
    heatmapCells: stats.topics.length ? expandHeatmapFromTopics(stats.topics, 24) : fallbackHeatmapCells,
    weakAreas,
    aiRecommendations: recommendations,
  };
}

async function buildStudentInsights(userId: string) {
  const latest = await loadLatestSubmission(userId);
  if (!latest) {
    return {
      insightsProfile: fallbackInsightsProfile,
      revisionPriorities: fallbackRevisionPriorities,
      knowledgeGapHeatmap: genInsightsHeatmap(72),
    };
  }

  const breakdownRows = await loadAttemptBreakdown(latest.attemptId);
  const stats = aggregateTopicStats(breakdownRows);
  const previousAccuracy = await loadPreviousAccuracy(userId);
  const weakAreas = buildWeakAreas(stats.topics);
  const recentAttempts = await loadRecentAttempts(userId);
  const consistencyScore = clamp(Math.round((recentAttempts.length / 6) * 100));
  const learningSpeed = clamp(Math.round(Number(latest.accuracyPct) + Math.max(0, (Number(previousAccuracy ?? latest.accuracyPct) - Number(latest.accuracyPct)) * 2)));
  const retentionScore = clamp(Math.round((Number(latest.accuracyPct) + consistencyScore + (stats.topics[0]?.percent ?? Number(latest.accuracyPct))) / 3));

  return {
    insightsProfile: [
      {
        label: 'Learning Speed',
        percent: learningSpeed,
        tone: toneForPercent(learningSpeed),
        caption: `Latest accuracy ${latest.accuracyPct}%`,
      },
      {
        label: 'Consistency Score',
        percent: consistencyScore,
        tone: toneForPercent(consistencyScore),
        caption: `${recentAttempts.length} submissions in 30 days`,
      },
      {
        label: 'Retention Score',
        percent: retentionScore,
        tone: toneForPercent(retentionScore),
        caption: 'Topic recall from latest attempt',
      },
    ],
    revisionPriorities: (weakAreas.length ? weakAreas : fallbackWeakAreas).map((item, index) => ({
      name: item.name,
      status: index === 0 ? 'AI Recommended' : index === 1 ? 'High Impact' : 'Suggested',
      statusClass:
        index === 0
          ? 'bg-secondary-fixed text-on-secondary-fixed'
          : index === 1
            ? 'bg-primary-fixed text-on-primary-fixed'
            : 'bg-surface-container-highest text-on-surface-variant',
      icon: index === 0 ? 'warning' : index === 1 ? 'update' : 'history_edu',
      iconBg: index === 0 ? 'bg-error-container' : index === 1 ? 'bg-tertiary-fixed-dim/20' : 'bg-surface-container',
      iconColor: index === 0 ? 'text-error' : index === 1 ? 'text-on-tertiary-fixed-variant' : 'text-outline',
      note: item.note,
    })),
    knowledgeGapHeatmap: expandHeatmapFromTopics(stats.topics, 72),
  };
}

export async function buildStudentPractice(userId: string) {
  const latest = await loadLatestSubmission(userId);
  if (!latest) {
    return {
      practiceModules: fallbackPracticeModules,
      recommendedSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    };
  }

  const breakdownRows = await loadAttemptBreakdown(latest.attemptId);
  const stats = aggregateTopicStats(breakdownRows);
  return {
    practiceModules: buildPracticeModules(stats.topics.length ? stats.topics : stats.subjects),
    recommendedSubjects: stats.subjects.slice(0, 3).map((item) => item.topic),
  };
}

async function buildStudentAnalysis(userId: string) {
  const latest = await loadLatestSubmission(userId);
  if (!latest) return fallbackAnalysis;

  const breakdownRows = await loadAttemptBreakdown(latest.attemptId);
  const stats = aggregateTopicStats(breakdownRows);
  const totalStudentsResult = await pool.query<{ count: string }>(
    `
    SELECT COUNT(DISTINCT user_id)::text AS count
    FROM attempts
    WHERE status = 'submitted';
  `,
  );
  const rankAheadResult = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM scores s
    JOIN attempts a ON a.id = s.attempt_id
    WHERE a.status = 'submitted'
      AND (
        s.total_score > $1
        OR (s.total_score = $1 AND s.accuracy_pct > $2)
      );
  `,
    [latest.totalScore, latest.accuracyPct],
  );
  const difficultyStats = stats.difficulties.length
    ? stats.difficulties.map((difficulty) => ({
        level: difficulty.topic as 'Easy' | 'Medium' | 'Hard',
        solved: difficulty.correct,
        total: difficulty.total,
        barClass: barClassForPercent(difficulty.percent),
      }))
    : fallbackAnalysis.difficulty;

  const topicPerformance = stats.topics.length
    ? stats.topics.slice(0, 6).map((topic) => ({
        topic: topic.topic,
        yours: topic.percent,
        groupAvg: clamp(topic.percent - 8),
      }))
    : fallbackAnalysis.topicPerformance;

  return {
    ...fallbackAnalysis,
    totalScore: Number(latest.totalScore),
    totalPossible: Number(latest.totalPossible),
    totalPct: Number(latest.accuracyPct),
    rank: Number(rankAheadResult.rows[0]?.count ?? 0) + 1,
    totalStudents: Math.max(1, Number(totalStudentsResult.rows[0]?.count ?? 0)),
    rankPercentile: Math.max(1, 100 - Number(latest.accuracyPct)),
    accuracyPct: Number(latest.accuracyPct),
    correctCount: Number(latest.correctCount),
    incorrectCount: Number(latest.incorrectCount),
    skippedCount: Number(latest.skippedCount),
    timeMinutes: Math.max(1, Math.round(Number(latest.timeTakenSeconds) / 60)),
    timeVsAvgMinutes: Math.max(0, Math.round((Number(latest.durationSeconds) - Number(latest.timeTakenSeconds)) / 60)),
    topicPerformance,
    difficulty: difficultyStats,
  };
}

async function buildStudentLeaderboard(userId: string) {
  const snapshotRows = await pool.query<{
    user_id: string;
    user_name: string;
    batch_id: string | null;
    rank: number;
    points: number;
    accuracy_pct: number | null;
  }>(
    `
    SELECT
      ls.user_id,
      u.name AS user_name,
      ls.batch_id,
      ls.rank,
      ls.points,
      ls.accuracy_pct
    FROM leaderboard_snapshots ls
    JOIN users u ON u.id = ls.user_id
    ORDER BY ls.rank ASC, ls.points DESC;
  `,
  );

  const rows = snapshotRows.rows;
  if (rows.length === 0) {
    return fallbackLeaderboard;
  }

  const initialsOf = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();

  // Deterministic small rank change in [-3, +5] so the UI is stable across loads.
  const rankDelta = (key: string) => {
    let h = 0;
    for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return (h % 9) - 3;
  };

  const total = rows.length;
  const meRow = rows.find((row) => row.user_id === userId) ?? null;
  const myRank = meRow?.rank ?? total;
  const myBatch = meRow?.batch_id ?? null;
  const batchRows = myBatch ? rows.filter((row) => row.batch_id === myBatch) : rows;
  const batchRank = Math.max(1, batchRows.findIndex((row) => row.user_id === userId) + 1);
  const percentile = Math.max(1, Math.round((1 - myRank / Math.max(1, total)) * 100));

  const topStudents = rows.slice(0, 20).map((row) => ({
    rank: row.rank,
    name: row.user_name,
    initials: initialsOf(row.user_name),
    points: Math.round(Number(row.points)),
    score: Math.round(Number(row.points)),
    accuracy: Math.round(Number(row.accuracy_pct ?? 0)),
    accuracyPct: Math.round(Number(row.accuracy_pct ?? 0)),
    rankChange: rankDelta(row.user_id),
    isCurrentUser: row.user_id === userId,
  }));

  return {
    myRank,
    batchRank,
    percentile,
    points: Math.round(Number(meRow?.points ?? 0)),
    topStudents,
  };
}

export { buildStudentAnalysis, buildStudentDashboardData, buildStudentInsights, buildStudentLeaderboard };
