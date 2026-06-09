import { pool } from '../db/client';
import { genInsightsHeatmap } from '../src/mocks/student';
import { rolePermissions, type Role } from './seed';

export interface AdminMetricTile {
  label: string;
  value: string;
  delta: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'tertiary' | 'muted';
}

export interface AdminUserRow {
  name: string;
  role: 'Student' | 'Parent' | 'Faculty' | 'Admin';
  email: string;
  status: 'Active' | 'Pending' | 'Suspended';
  lastActive: string;
}

export interface AdminInstituteRow {
  name: string;
  region: string;
  plan: 'Starter' | 'Growth' | 'Enterprise';
  students: string;
  performance: string;
}

export interface AdminDashboardResponse {
  metrics: AdminMetricTile[];
  heatmap: ReturnType<typeof genInsightsHeatmap>;
  topInstitutions: Array<{ name: string; region: string; score: string; sessions: string }>;
  healthLogs: Array<{ title: string; detail: string; time: string }>;
  securityNotes: string[];
}

export interface AdminUsersResponse {
  metrics: AdminMetricTile[];
  users: AdminUserRow[];
  total: number;
  aiUsageInsights: Array<{ label: string; percent: number }>;
  recommendation: string;
}

export interface AdminInstitutesResponse {
  metrics: AdminMetricTile[];
  institutes: AdminInstituteRow[];
  regionalPerformanceHeatmap: ReturnType<typeof genInsightsHeatmap>;
  optimizationTip: string;
}

function titleCaseRole(role: Role): AdminUserRow['role'] {
  if (role === 'student') return 'Student';
  if (role === 'parent') return 'Parent';
  if (role === 'faculty') return 'Faculty';
  return 'Admin';
}

function formatRelativeActive(dateValue: string | null) {
  if (!dateValue) return 'Just now';
  const value = new Date(dateValue);
  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export async function getAdminDashboardData(): Promise<AdminDashboardResponse> {
  const [institutesResult, activeUsersResult, testsResult, attemptsResult, rolesResult, topInstitutionsResult, logsResult] =
    await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM institutes'),
      pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE status = 'Active'"),
      pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM tests'),
      pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM attempts WHERE status = 'active'"),
      pool.query<{ plan: string; count: string }>(
        `
        SELECT plan, COUNT(*)::text AS count
        FROM institutes
        GROUP BY plan;
      `,
      ),
      pool.query<{
        name: string;
        region: string;
        score: number | null;
        sessions: number;
      }>(
        `
        WITH latest_scores AS (
          SELECT
            a.user_id,
            s.accuracy_pct,
            ROW_NUMBER() OVER (PARTITION BY a.user_id ORDER BY s.computed_at DESC) AS rn
          FROM attempts a
          JOIN scores s ON s.attempt_id = a.id
          WHERE a.status = 'submitted'
        )
        SELECT
          i.name,
          i.region,
          ROUND(COALESCE(AVG(ls.accuracy_pct), 0), 1) AS score,
          COUNT(DISTINCT a.id)::int AS sessions
        FROM institutes i
        LEFT JOIN users u ON u.institute_id = i.id
        LEFT JOIN attempts a ON a.user_id = u.id AND a.status = 'submitted'
        LEFT JOIN latest_scores ls ON ls.user_id = u.id AND ls.rn = 1
        GROUP BY i.id
        ORDER BY score DESC, sessions DESC
        LIMIT 3;
      `,
      ),
      pool.query<{
        action: string;
        detail: string;
        severity: 'info' | 'warning' | 'critical';
        created_at: string;
      }>(
        `
        SELECT action, detail, severity, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 4;
      `,
      ),
    ]);

  const instituteCount = Number(institutesResult.rows[0]?.count ?? 0);
  const activeUsers = Number(activeUsersResult.rows[0]?.count ?? 0);
  const totalTests = Number(testsResult.rows[0]?.count ?? 0);
  const activeSessions = Number(attemptsResult.rows[0]?.count ?? 0);
  const planCounts = new Map(rolesResult.rows.map((row) => [row.plan, Number(row.count)]));
  const annualRevenue = Math.round(
    (planCounts.get('Starter') ?? 0) * 1200 * 12 +
      (planCounts.get('Growth') ?? 0) * 3500 * 12 +
      (planCounts.get('Enterprise') ?? 0) * 9500 * 12,
  );

  return {
    metrics: [
      {
        label: 'Total Institutions',
        value: instituteCount.toLocaleString(),
        delta: `${planCounts.get('Enterprise') ?? 0} enterprise plans`,
        icon: 'apartment',
        tone: 'primary',
      },
      {
        label: 'Active Users',
        value: activeUsers.toLocaleString(),
        delta: `${activeSessions} active sessions now`,
        icon: 'group',
        tone: 'secondary',
      },
      {
        label: 'Annual Revenue',
        value: `$${(annualRevenue / 1_000_000).toFixed(1)}M`,
        delta: 'Plan-based estimate',
        icon: 'paid',
        tone: 'tertiary',
      },
      {
        label: 'Active Tests',
        value: totalTests.toLocaleString(),
        delta: 'Saved in PostgreSQL',
        icon: 'running_with_errors',
        tone: 'muted',
      },
    ],
    heatmap: genInsightsHeatmap(144),
    topInstitutions: topInstitutionsResult.rows.map((row) => ({
      name: row.name,
      region: row.region,
      score: Number(row.score ?? 0).toFixed(1),
      sessions: row.sessions.toLocaleString(),
    })),
    healthLogs: logsResult.rows.map((row) => ({
      title: row.action
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      detail: row.detail,
      time: formatTime(row.created_at),
    })),
    securityNotes: ['SOC2 Compliant', '99.9% Uptime', 'Encrypted Multi-Tenancy'],
  };
}

export async function listAdminUsers(search: string, tab: string): Promise<AdminUsersResponse> {
  const result = await pool.query<{
    name: string;
    email: string;
    status: string;
    last_active_at: string | null;
    role_key: Role;
  }>(
    `
    SELECT
      u.name,
      u.email,
      u.status,
      u.last_active_at,
      ur.role_key
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    ORDER BY u.created_at DESC;
  `,
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = result.rows.filter((row) => {
    const matchesTab =
      tab === 'All' ||
      (tab === 'Students' && row.role_key === 'student') ||
      (tab === 'Faculty' && row.role_key === 'faculty') ||
      (tab === 'Administrators' && row.role_key === 'admin');
    const matchesSearch = `${row.name} ${row.email} ${titleCaseRole(row.role_key)} ${row.status}`
      .toLowerCase()
      .includes(normalizedSearch);
    return matchesTab && matchesSearch;
  });

  const activeCount = result.rows.filter((row) => row.status === 'Active').length;
  const pendingCount = result.rows.filter((row) => row.status === 'Pending').length;
  const suspendedCount = result.rows.filter((row) => row.status === 'Suspended').length;

  return {
    metrics: [
      {
        label: 'Total Users',
        value: result.rows.length.toLocaleString(),
        delta: `${activeCount} active`,
        icon: 'groups',
        tone: 'primary',
      },
      {
        label: 'Active Now',
        value: activeCount.toLocaleString(),
        delta: 'Live platform accounts',
        icon: 'radio_button_checked',
        tone: 'secondary',
      },
      {
        label: 'Pending',
        value: pendingCount.toLocaleString(),
        delta: 'Awaiting review',
        icon: 'pending_actions',
        tone: 'tertiary',
      },
      {
        label: 'Suspended',
        value: suspendedCount.toLocaleString(),
        delta: 'Policy review',
        icon: 'block',
        tone: 'muted',
      },
    ],
    users: filtered.map((row) => ({
      name: row.name,
      role: titleCaseRole(row.role_key),
      email: row.email,
      status: row.status as AdminUserRow['status'],
      lastActive: formatRelativeActive(row.last_active_at),
    })),
    total: filtered.length,
    aiUsageInsights: [
      { label: 'Student logins', percent: 86 },
      { label: 'Faculty activity', percent: 72 },
      { label: 'Admin operations', percent: 54 },
      { label: 'Parent check-ins', percent: 41 },
    ],
    recommendation: 'User activity is concentrated in weekday mornings. Schedule non-urgent maintenance after 02:00 UTC.',
  };
}

export async function listAdminInstitutes(region: string, plan: string): Promise<AdminInstitutesResponse> {
  const result = await pool.query<{
    name: string;
    region: string;
    plan: 'Starter' | 'Growth' | 'Enterprise';
    students: number;
    performance: number | null;
  }>(
    `
    WITH latest_scores AS (
      SELECT
        a.user_id,
        s.accuracy_pct,
        ROW_NUMBER() OVER (PARTITION BY a.user_id ORDER BY s.computed_at DESC) AS rn
      FROM attempts a
      JOIN scores s ON s.attempt_id = a.id
      WHERE a.status = 'submitted'
    )
    SELECT
      i.name,
      i.region,
      i.plan,
      COUNT(DISTINCT u.id)::int AS students,
      ROUND(COALESCE(AVG(ls.accuracy_pct), 0), 1) AS performance
    FROM institutes i
    LEFT JOIN users u ON u.institute_id = i.id
    LEFT JOIN latest_scores ls ON ls.user_id = u.id AND ls.rn = 1
    GROUP BY i.id
    ORDER BY i.created_at ASC;
  `,
  );

  const filtered = result.rows.filter((row) => {
    const matchesRegion = region === 'All' || row.region === region;
    const matchesPlan = plan === 'All' || row.plan === plan;
    return matchesRegion && matchesPlan;
  });

  const totalStudents = result.rows.reduce((sum, row) => sum + row.students, 0);
  const avgPerformance = result.rows.length
    ? result.rows.reduce((sum, row) => sum + Number(row.performance ?? 0), 0) / result.rows.length
    : 0;

  return {
    metrics: [
      {
        label: 'Total Institutions',
        value: result.rows.length.toLocaleString(),
        delta: `${filtered.length} visible`,
        icon: 'apartment',
        tone: 'primary',
      },
      {
        label: 'Total Revenue',
        value: `$${Math.max(1, Math.round(totalStudents * 92)).toLocaleString()}`,
        delta: 'Estimated monthly run rate',
        icon: 'payments',
        tone: 'secondary',
      },
      {
        label: 'Total Students',
        value: totalStudents.toLocaleString(),
        delta: 'Across active institutes',
        icon: 'school',
        tone: 'tertiary',
      },
      {
        label: 'Performance Index',
        value: `${avgPerformance.toFixed(1)}/100`,
        delta: 'System-wide average accuracy',
        icon: 'monitor_heart',
        tone: 'muted',
      },
    ],
    institutes: filtered.map((row) => ({
      name: row.name,
      region: row.region,
      plan: row.plan,
      students: row.students.toLocaleString(),
      performance: Number(row.performance ?? 0).toFixed(1),
    })),
    regionalPerformanceHeatmap: genInsightsHeatmap(35).slice(0, 35),
    optimizationTip:
      'Institutes with lower latest-attempt accuracy are concentrated in the growth tier. Focus scheduler and content interventions there first.',
  };
}

export async function listReferenceRoles() {
  const result = await pool.query<{ key: string }>('SELECT key FROM roles ORDER BY key ASC');
  return result.rows.map((row) => ({
    key: row.key,
    permissions: rolePermissions[row.key as Role] ?? [],
  }));
}
