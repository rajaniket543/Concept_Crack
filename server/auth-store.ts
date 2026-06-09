import crypto from 'node:crypto';
import { pool, withTransaction } from '../db/client';
import { rolePermissions, type Role } from './seed';

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: Role;
  email: string;
  mobile: string;
  status: string;
  permissions: string[];
}

export interface AuthContext {
  token: string;
  expiresAt: string;
  user: AuthenticatedUser;
}

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function mapUser(row: {
  id: string;
  name: string;
  email: string;
  mobile: string;
  status: string;
  role_key: Role | null;
}) {
  const role = row.role_key ?? 'student';
  return {
    id: row.id,
    name: row.name,
    role,
    email: row.email,
    mobile: row.mobile,
    status: row.status,
    permissions: rolePermissions[role] ?? [],
  };
}

export async function findUserByIdentifier(identifier: string, role?: Role) {
  const result = await pool.query<{
    id: string;
    name: string;
    email: string;
    mobile: string;
    password_salt: string;
    password_hash: string;
    status: string;
    role_key: Role | null;
  }>(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.mobile,
      u.password_salt,
      u.password_hash,
      u.status,
      ur.role_key
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE (
      LOWER(u.email) = LOWER($1)
      OR LOWER(u.mobile) = LOWER($1)
      OR LOWER(u.name) = LOWER($1)
    )
    AND ($2::text IS NULL OR ur.role_key = $2)
    ORDER BY CASE WHEN ur.role_key IS NULL THEN 1 ELSE 0 END
    LIMIT 1;
  `,
    [identifier.trim(), role ?? null],
  );

  const row = result.rows[0];
  return row
    ? {
        ...mapUser(row),
        passwordSalt: row.password_salt,
        passwordHash: row.password_hash,
      }
    : null;
}

export async function findUserById(id: string) {
  const result = await pool.query<{
    id: string;
    name: string;
    email: string;
    mobile: string;
    status: string;
    role_key: Role | null;
  }>(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.mobile,
      u.status,
      ur.role_key
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.id = $1
    ORDER BY CASE WHEN ur.role_key IS NULL THEN 1 ELSE 0 END
    LIMIT 1;
  `,
    [id],
  );
  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

export async function createSession(userId: string) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await pool.query(
    `
    INSERT INTO auth_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3);
  `,
    [userId, hashValue(token), expiresAt.toISOString()],
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getSessionFromToken(token: string): Promise<AuthContext | null> {
  const tokenHash = hashValue(token);
  const result = await pool.query<{
    token_hash: string;
    expires_at: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_mobile: string;
    user_status: string;
    role_key: Role | null;
  }>(
    `
    SELECT
      s.token_hash,
      s.expires_at,
      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,
      u.mobile AS user_mobile,
      u.status AS user_status,
      ur.role_key
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    ORDER BY CASE WHEN ur.role_key IS NULL THEN 1 ELSE 0 END
    LIMIT 1;
  `,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    token,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      name: row.user_name,
      role: (row.role_key ?? 'student') as Role,
      email: row.user_email,
      mobile: row.user_mobile,
      status: row.user_status,
      permissions: rolePermissions[(row.role_key ?? 'student') as Role] ?? [],
    },
  };
}

export async function revokeSession(token: string) {
  const tokenHash = hashValue(token);
  await pool.query(
    `
    UPDATE auth_sessions
    SET revoked_at = now()
    WHERE token_hash = $1
      AND revoked_at IS NULL;
  `,
    [tokenHash],
  );
}

export async function countActiveSessions() {
  const result = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM auth_sessions
    WHERE revoked_at IS NULL
      AND expires_at > now();
  `,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function createOtpChallenge(userId: string) {
  const challengeId = `otp_${crypto.randomUUID().replace(/-/g, '')}`;
  const code = String(100000 + Math.floor(Math.random() * 900000));
  const otpHash = hashValue(code);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10);
  await pool.query(
    `
    INSERT INTO otp_challenges (user_id, challenge_id, otp_hash, expires_at)
    VALUES ($1, $2, $3, $4);
  `,
    [userId, challengeId, otpHash, expiresAt.toISOString()],
  );
  return { challengeId, code, expiresAt: expiresAt.toISOString() };
}

export async function verifyOtpChallenge(challengeId: string, code: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{
      user_id: string;
      expires_at: string;
      consumed_at: string | null;
      otp_hash: string;
    }>(
      `
      SELECT user_id, expires_at, consumed_at, otp_hash
      FROM otp_challenges
      WHERE challenge_id = $1
      FOR UPDATE;
    `,
      [challengeId],
    );
    const row = result.rows[0];
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }
    if (row.otp_hash !== hashValue(code)) {
      return null;
    }
    await client.query(
      `
      UPDATE otp_challenges
      SET consumed_at = now()
      WHERE challenge_id = $1;
    `,
      [challengeId],
    );
    const user = await findUserById(row.user_id);
    return user;
  });
}

export async function createResetToken(userId: string) {
  const resetToken = `reset_${crypto.randomUUID().replace(/-/g, '')}`;
  const tokenHash = hashValue(resetToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  await pool.query(
    `
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3);
  `,
    [userId, tokenHash, expiresAt.toISOString()],
  );
  return { resetToken, expiresAt: expiresAt.toISOString() };
}

export async function consumeResetToken(resetToken: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{
      user_id: string;
      expires_at: string;
      used_at: string | null;
    }>(
      `
      SELECT user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = $1
      FOR UPDATE;
    `,
      [hashValue(resetToken)],
    );
    const row = result.rows[0];
    if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }
    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE token_hash = $1;
    `,
      [hashValue(resetToken)],
    );
    return row.user_id;
  });
}

export async function updatePassword(userId: string, salt: string, hash: string) {
  await pool.query(
    `
    UPDATE users
    SET password_salt = $2,
        password_hash = $3,
        updated_at = now()
    WHERE id = $1;
  `,
    [userId, salt, hash],
  );
}

export async function writeAuditLog(
  actorUserId: string | null,
  actorRoleKey: Role | null,
  action: string,
  detail: string,
  severity: 'info' | 'warning' | 'critical' = 'info',
) {
  await pool.query(
    `
    INSERT INTO audit_logs (actor_user_id, actor_role_key, action, detail, severity)
    VALUES ($1, $2, $3, $4, $5);
  `,
    [actorUserId, actorRoleKey, action, detail, severity],
  );
}

export async function listAuditLogs(limit = 200) {
  const result = await pool.query<{
    id: string;
    actor_user_id: string | null;
    actor_role_key: Role | null;
    action: string;
    detail: string;
    severity: 'info' | 'warning' | 'critical';
    created_at: string;
  }>(
    `
    SELECT
      id,
      actor_user_id,
      actor_role_key,
      action,
      detail,
      severity,
      created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT $1;
  `,
    [limit],
  );
  return result.rows;
}

export async function writeNotification(
  title: string,
  body: string,
  roleKey?: Role,
  userId?: string | null,
  channel: 'in_app' | 'email' | 'sms' | 'whatsapp' = 'in_app',
  status: string = 'queued',
) {
  await pool.query(
    `
    INSERT INTO notifications (user_id, role_key, title, body, channel, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, now());
  `,
    [userId ?? null, roleKey ?? null, title, body, channel, status],
  );
}

export async function listNotifications(limit = 100) {
  const result = await pool.query<{
    id: string;
    user_id: string | null;
    role_key: Role | null;
    title: string;
    body: string;
    channel: 'in_app' | 'email' | 'sms' | 'whatsapp';
    status: string;
    created_at: string;
  }>(
    `
    SELECT
      id,
      user_id,
      role_key,
      title,
      body,
      channel,
      status,
      created_at
    FROM notifications
    ORDER BY created_at DESC
    LIMIT $1;
  `,
    [limit],
  );
  return result.rows;
}
