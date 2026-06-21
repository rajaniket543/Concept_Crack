export type AuthRole = 'student' | 'parent' | 'faculty' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  role: AuthRole;
  email: string;
  mobile: string;
  permissions: string[];
}

export interface AuthSession {
  token: string;
  expiresAt: number;
  user: AuthUser;
  redirectTo: string;
}

const STORAGE_KEY = 'prepmind_auth_session';

export function getAuthSession(): AuthSession | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getAuthToken() {
  return getAuthSession()?.token ?? null;
}

export async function login(payload: {
  identifier: string;
  password: string;
  role: AuthRole;
  method: 'email' | 'mobile';
}) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Login failed.');
  }
  const session = data.data as AuthSession;
  setAuthSession(session);
  return session;
}

export async function register(payload: {
  name: string;
  email: string;
  mobile: string;
  password: string;
}) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Registration failed.');
  }
  const session = data.data as AuthSession;
  setAuthSession(session);
  return session;
}

export async function requestOtp(payload: { identifier: string; role: AuthRole }) {
  const response = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'OTP request failed.');
  }
  return data.data as { challengeId: string; devCode: string; expiresInSeconds: number; message: string };
}

export async function verifyOtp(payload: { challengeId: string; code: string }) {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'OTP verification failed.');
  }
  const session = data.data as AuthSession;
  setAuthSession(session);
  return session;
}

export async function logout() {
  const token = getAuthToken();
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  clearAuthSession();
}

