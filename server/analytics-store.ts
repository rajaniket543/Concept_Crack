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
      a.id AS attempt_id,
      a.user_id,
      u.name AS user_name,
      b.name AS batch_name,
      i.name AS institute_name,
      t.code AS exam_id,
      a.started_at::text AS started_at,
      a.submitted_at::text AS submitted_at,
      t.duration_seconds AS durationSeconds,
      a.time_taken_seconds,
      s.total_score,
      s.total_possible,
      s.correct_count,
      s.incorrect_count,
      s.skipped_count,
      s.accuracy_pct
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
      subj.name AS subject_name,
      ch.name AS chapter_name,
      q.difficulty,
      q.public_id,
      aa.selected_option,
      q.correct_option
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

function buildDashboardMetrics(latest: Awaited<ReturnType<typeof loadLatestSubmission>>, previousAccuracy: number | null) {
  if (!latest) return fallbackDashboardMetrics;
  const accuracy = Number(latest.accuracy_pct);
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
      value: '#1',
      delta: `Top ${Math.max(1, 100 - accuracy)}% Institutional`,
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
    const day = d.toISOString().slice(0, 10);
    const label = dayKey(d);
    const accuracy = dayMap.get(day) ?? 0;
    return { day: label, percent: accuracy };
  });

  const metrics = buildDashboardMetrics(latest, previousAccuracy);

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
  const learningSpeed = clamp(Math.round(Number(latest.accuracy_pct) + Math.max(0, (Number(previousAccuracy ?? latest.accuracy_pct) - Number(latest.accuracy_pct)) * 2)));
  const retentionScore = clamp(Math.round((Number(latest.accuracy_pct) + consistencyScore + (stats.topics[0]?.percent ?? Number(latest.accuracy_pct))) / 3));

  return {
    insightsProfile: [
      {
        label: 'Learning Speed',
        percent: learningSpeed,
        tone: toneForPercent(learningSpeed),
        caption: `Latest accuracy ${latest.accuracy_pct}%`,
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
    rank: number;
    points: number;
    accuracy_pct: number | null;
    snapshot_key: string;
  }>(
    `
    SELECT
      ls.user_id,
      u.name AS user_name,
      ls.rank,
      ls.points,
      ls.accuracy_pct,
      ls.snapshot_key
    FROM leaderboard_snapshots ls
    JOIN users u ON u.id = ls.user_id
    ORDER BY ls.rank ASC, ls.points DESC;
  `,
  );

  const latest = await loadLatestSubmission(userId);
  if (!latest || snapshotRows.rows.length === 0) {
    return fallbackLeaderboard;
  }

  const podium = snapshotRows.rows
    .slice(0, 3)
    .map((row, index) => ({
      rank: (index + 1) as 1 | 2 | 3,
      name: row.user_name,
      points: Number(row.points),
      avatarUrl: fallbackLeaderboard.podium[index]?.avatarUrl ?? fallbackLeaderboard.podium[0].avatarUrl,
      tone: fallbackLeaderboard.podium[index]?.tone ?? 'gold',
      delay: fallbackLeaderboard.podium[index]?.delay ?? 0,
    }));

  const batch = snapshotRows.rows.slice(0, 4).map((row, index) => ({
    rank: row.rank,
    name: row.user_id === userId ? `You (${row.user_name})` : row.user_name,
    points: Number(row.points),
    deltaPct: index === 0 ? 12 : index === 1 ? 5 : index === 2 ? -2 : 0,
    isCurrentUser: row.user_id === userId,
    highlight: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'none',
    avatarUrl: fallbackLeaderboard.batch[index]?.avatarUrl,
    badge: row.user_id === userId ? 'Current' : undefined,
  }));

  const currentRank = snapshotRows.rows.find((row) => row.user_id === userId)?.rank ?? 1;
  const userPerformance = {
    rank: currentRank,
    outOf: Math.max(1, snapshotRows.rows.length),
    masteryPct: Number(latest.accuracyPct),
    streakDays: Math.max(1, Math.min(30, Math.round(latest.timeTakenSeconds / 240))),
    percentile: `Top ${Math.max(1, 100 - Number(latest.accuracyPct))}% in your batch`,
  };

  return {
    podium: podium.length === 3 ? podium : fallbackLeaderboard.podium,
    batch: batch.length ? batch : fallbackLeaderboard.batch,
    subject: fallbackLeaderboard.subject,
    userPerformance,
    motivation: {
      headline: `You're only ${Math.max(0, 100 - Number(latest.totalScore))} points away from the next tier!`,
      body: `Your latest ${Number(latest.accuracyPct)}% accuracy is being tracked against real submitted attempts.`,
    },
  };
}

export { buildStudentAnalysis, buildStudentDashboardData, buildStudentInsights, buildStudentLeaderboard };
