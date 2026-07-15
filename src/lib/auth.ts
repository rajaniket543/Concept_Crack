import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { clearStudentStream, saveStreamLocal, type StudentStream } from './stream';
import { auth, db } from './firebase';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthRole = 'student' | 'parent' | 'faculty' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  role: AuthRole;
  email: string;
  mobile: string;
  permissions: string[];
  // Set by an admin at account creation; forces the Change Password page on
  // every route until cleared. Persisted on the session (not re-read from
  // Firestore per navigation) so the route guard can check it synchronously.
  mustChangePassword: boolean;
}

export interface AuthSession {
  token: string;
  expiresAt: number;
  user: AuthUser;
  redirectTo: string;
}

// ── Role → portal path ───────────────────────────────────────────────────────

const ROLE_PATH: Record<AuthRole, string> = {
  student: '/student',
  parent:  '/parent',
  faculty: '/faculty',
  admin:   '/admin',
};

// ── LocalStorage session (kept for backward-compat with portal pages) ────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildSession(uid: string, selectedRole: AuthRole): Promise<AuthSession> {
  const firebaseUser = auth.currentUser!;
  const token = await firebaseUser.getIdToken();

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  let userData: AuthUser;

  if (userSnap.exists()) {
    const data = userSnap.data();

    // Role mismatch — wrong portal selected
    if (data.role !== selectedRole) {
      await signOut(auth);
      throw new Error(
        `This account is registered as "${data.role}". Please select the correct portal.`
      );
    }

    // Block inactive / suspended accounts
    if (data.status === 'Inactive' || data.status === 'Suspended') {
      await signOut(auth);
      throw new Error(
        `Your account has been ${(data.status as string).toLowerCase()}. Please contact admin.`,
      );
    }

    userData = {
      id:          uid,
      name:        data.name        ?? firebaseUser.displayName ?? 'User',
      role:        data.role        as AuthRole,
      email:       data.email       ?? firebaseUser.email ?? '',
      mobile:      data.mobile      ?? '',
      permissions: data.permissions ?? [],
      mustChangePassword: data.mustChangePassword === true,
    };

    // The exam stream (JEE / NEET) is assigned by the admin at registration —
    // students never pick it themselves. Apply it to this device on login.
    if (data.role === 'student') {
      const stream = (data.stream === 'NEET' ? 'NEET' : 'JEE') as StudentStream;
      saveStreamLocal(stream);
    }

    // Update last-active timestamp (fire-and-forget)
    void setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
  } else {
    // First-time login — auto-create the Firestore profile
    userData = {
      id:          uid,
      name:        firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User',
      role:        selectedRole,
      email:       firebaseUser.email ?? '',
      mobile:      '',
      permissions: [],
      mustChangePassword: false, // self-registered accounts never require this
    };
    await setDoc(userRef, {
      ...userData,
      status:    'Active',
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    });
    if (selectedRole === 'student') saveStreamLocal('JEE');
  }

  // Redirect to password-change page on first login
  const session: AuthSession = {
    token,
    expiresAt:  Date.now() + 60 * 60 * 1000, // 1 hour
    user:       userData,
    redirectTo: userData.mustChangePassword ? '/change-password' : ROLE_PATH[selectedRole],
  };

  setAuthSession(session);
  return session;
}

// ── Auth functions ───────────────────────────────────────────────────────────

export async function login(payload: {
  identifier: string;
  password:   string;
  role:       AuthRole;
}): Promise<AuthSession> {
  const credential = await signInWithEmailAndPassword(
    auth,
    payload.identifier.trim(),
    payload.password
  );
  return buildSession(credential.user.uid, payload.role);
}

export async function loginWithGoogle(role: AuthRole): Promise<AuthSession> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return buildSession(credential.user.uid, role);
}

// ── Forgot password ──────────────────────────────────────────────────────────
// Step 1: a secure one-time reset code is emailed to the user.
// Step 2: if the link opens back in the app (?mode=resetPassword&oobCode=…),
//         the new password is set right on the login page.

export async function forgotPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim(), {
    url: `${window.location.origin}/login`,
    handleCodeInApp: false,
  });
}

/** Validates the emailed reset code and returns the account email it belongs to. */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

/** Completes the reset: sets the new password for the code's account. */
export async function completePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

export async function logout() {
  clearAuthSession();
  clearStudentStream();
  await signOut(auth);
}
