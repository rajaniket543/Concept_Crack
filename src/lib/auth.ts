import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { clearStudentStream } from './stream';
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
    };

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
    };
    await setDoc(userRef, {
      ...userData,
      status:    'Active',
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    });
  }

  // Redirect to password-change page on first login
  const mustChange = userSnap.exists() && userSnap.data().mustChangePassword === true;

  const session: AuthSession = {
    token,
    expiresAt:  Date.now() + 60 * 60 * 1000, // 1 hour
    user:       userData,
    redirectTo: mustChange ? '/change-password' : ROLE_PATH[selectedRole],
  };

  setAuthSession(session);
  return session;
}

// ── Auth functions ───────────────────────────────────────────────────────────

export async function login(payload: {
  identifier: string;
  password:   string;
  role:       AuthRole;
  method:     'email' | 'mobile';
}): Promise<AuthSession> {
  const credential = await signInWithEmailAndPassword(
    auth,
    payload.identifier.trim(),
    payload.password
  );
  return buildSession(credential.user.uid, payload.role);
}

export async function requestOtp(payload: { identifier: string; role: AuthRole }) {
  const actionCodeSettings = {
    url:            `${window.location.origin}/login?role=${payload.role}`,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, payload.identifier.trim(), actionCodeSettings);
  window.localStorage.setItem('otp_email', payload.identifier.trim());
  window.localStorage.setItem('otp_role',  payload.role);
  return {
    challengeId:      'email-link',
    devCode:          '',
    expiresInSeconds: 600,
    message:          `A sign-in link has been sent to ${payload.identifier}. Click the link in your email to sign in.`,
  };
}

export async function verifyOtp(payload: { challengeId: string; code: string }) {
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    throw new Error('No valid sign-in link found. Please request a new OTP.');
  }
  const email = window.localStorage.getItem('otp_email') ?? payload.code;
  const role  = (window.localStorage.getItem('otp_role') ?? 'student') as AuthRole;
  const credential = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem('otp_email');
  window.localStorage.removeItem('otp_role');
  return buildSession(credential.user.uid, role);
}

let _recaptchaVerifier: RecaptchaVerifier | null = null;

export async function sendPhoneOtp(phone: string, container: HTMLElement): Promise<ConfirmationResult> {
  if (_recaptchaVerifier) {
    _recaptchaVerifier.clear();
    _recaptchaVerifier = null;
  }
  container.innerHTML = '';
  _recaptchaVerifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  return signInWithPhoneNumber(auth, phone.trim(), _recaptchaVerifier);
}

export async function verifyPhoneOtp(
  confirmation: ConfirmationResult,
  code: string,
  role: AuthRole
): Promise<AuthSession> {
  const credential = await confirmation.confirm(code.trim());
  return buildSession(credential.user.uid, role);
}

export type { ConfirmationResult };

export async function loginWithGoogle(role: AuthRole): Promise<AuthSession> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return buildSession(credential.user.uid, role);
}

export async function forgotPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logout() {
  clearAuthSession();
  clearStudentStream();
  await signOut(auth);
}
