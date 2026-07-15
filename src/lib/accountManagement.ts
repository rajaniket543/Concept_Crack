import {
  sendPasswordResetEmail, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AuthRole } from './auth';

const FB_API_KEY = 'AIzaSyAh6QgSH9Y3Fp_wR_KMYrWVaNlshZj8ChM';

// Creates Firebase Auth account via REST API — does NOT sign out the current admin session
export async function restCreateAuth(
  email: string,
  password: string,
): Promise<{ uid: string; exists: boolean }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    },
  );
  const body = (await res.json()) as { localId?: string; error?: { message?: string } };
  if (!res.ok) {
    const msg = body.error?.message ?? 'UNKNOWN';
    if (msg === 'EMAIL_EXISTS') return { uid: '', exists: true };
    throw new Error(msg);
  }
  return { uid: body.localId ?? '', exists: false };
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: AuthRole;
  stream?: string;
  examTarget?: string;
  linkedStudentId?: string;
  facultyStream?: string;
}

export async function adminCreateUser(
  input: CreateUserInput,
): Promise<{ uid: string; created: boolean }> {
  const { uid, exists } = await restCreateAuth(input.email, 'Temp@1234');
  if (exists) return { uid: '', created: false };

  const extra: Record<string, unknown> = {};
  if (input.stream)          extra.stream          = input.stream;
  if (input.examTarget)      extra.examTarget      = input.examTarget;
  if (input.linkedStudentId) extra.linkedStudentId = input.linkedStudentId;
  if (input.facultyStream)   extra.facultyStream   = input.facultyStream;

  await setDoc(doc(db, 'users', uid), {
    name:               input.name,
    email:              input.email,
    role:               input.role,
    status:             'Active',
    permissions:        input.role === 'faculty' ? ['manage_questions', 'view_batch']
                      : input.role === 'admin'   ? ['all']
                      : [],
    mustChangePassword: true,
    ...extra,
    createdAt:          serverTimestamp(),
    lastActive:         serverTimestamp(),
  });

  return { uid, created: true };
}

export async function adminResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function adminSetUserStatus(
  uid: string,
  status: 'Active' | 'Inactive' | 'Suspended',
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { status }, { merge: true });
}

// Called by the user on their first-login forced-change screen. Re-verifies
// the current (temporary) password via Firebase reauthentication before
// updating — this is both the security requirement (never accept a new
// password without proving the old one) and the correct fix for Firebase's
// "recent login required" rule on updatePassword, rather than papering over
// a stale-session error by bouncing the user back to the login screen.
export async function completePasswordChange(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Not signed in');

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw new Error('Current password is incorrect.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Too many attempts — please wait a moment and try again.');
    }
    throw new Error('Could not verify your current password. Please sign in again.');
  }

  await updatePassword(user, newPassword);
  await setDoc(doc(db, 'users', user.uid), { mustChangePassword: false }, { merge: true });
}
