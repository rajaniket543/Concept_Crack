import { pool } from '../db/client';
import { writeNotification } from './auth-store';

export interface WeeklyReportSummary {
  userId: string;
  userName: string;
  role: 'student' | 'parent' | 'faculty' | 'admin';
  title: string;
  body: string;
  score: number;
  attendancePct: number;
  recentActivity: number;
  generatedAt: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

async function loadActiveUsers() {
  const result = await pool.query<{
    id: string;
    name: string;
    role_key: 'student' | 'parent' | 'faculty' | 'admin';
  }>(
    `
    SELECT u.id, u.name, ur.role_key
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.status = 'Active';
  `,
  );
  return result.rows;
}

async function latestStudentScore(userId: string) {
  const result = await pool.query<{ accuracy_pct: number }>(
    `
    SELECT s.accuracy_pct
    FROM scores s
    JOIN attempts a ON a.id = s.attempt_id
    WHERE a.user_id = $1
      AND a.status = 'submitted'
    ORDER BY s.computed_at DESC
    LIMIT 1;
  `,
    [userId],
  );
  return Number(result.rows[0]?.accuracy_pct ?? 0);
}

async function attendanceForUser(userId: string) {
  const result = await pool.query<{ status: string }>(
    `
    SELECT status
    FROM attendance_records
    WHERE user_id = $1
    ORDER BY session_date DESC
    LIMIT 30;
  `,
    [userId],
  );
  const total = result.rows.length || 1;
  const present = result.rows.filter((row) => row.status === 'Present').length;
  return clamp(Math.round((present / total) * 100));
}

async function recentActivityCount(userId: string) {
  const result = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM audit_logs
    WHERE actor_user_id = $1
      AND created_at >= now() - interval '7 days';
  `,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function buildWeeklyReports() {
  const users = await loadActiveUsers();
  const reports: WeeklyReportSummary[] = [];

  for (const user of users) {
    const score = user.role_key === 'student' ? await latestStudentScore(user.id) : 0;
    const attendancePct = user.role_key === 'student' ? await attendanceForUser(user.id) : 0;
    const activity = await recentActivityCount(user.id);
    const title =
      user.role_key === 'student'
        ? 'Weekly Student Progress Report'
        : user.role_key === 'parent'
          ? 'Weekly Parent Summary'
          : user.role_key === 'faculty'
            ? 'Weekly Faculty Overview'
            : 'Weekly Admin Summary';
    const body =
      user.role_key === 'student'
        ? `Latest score: ${score}%. Attendance: ${attendancePct}%.`
        : user.role_key === 'parent'
          ? `Your child's latest score is ${score}% with ${attendancePct}% attendance.`
          : user.role_key === 'faculty'
            ? `Your recent platform activity is ${activity} interactions this week.`
            : `Administrative activity logged ${activity} actions this week.`;

    reports.push({
      userId: user.id,
      userName: user.name,
      role: user.role_key,
      title,
      body,
      score,
      attendancePct,
      recentActivity: activity,
      generatedAt: new Date().toISOString(),
    });
  }

  return reports;
}

export async function queueWeeklyReportNotifications() {
  const reports = await buildWeeklyReports();
  for (const report of reports) {
    await writeNotification(report.title, report.body, report.role, report.userId, 'in_app', 'queued');
  }
  return reports.length;
}
