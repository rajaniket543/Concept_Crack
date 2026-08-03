import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import type { AuthRole } from './auth';

const PREFIX: Record<AuthRole, string> = {
  student: 'STU',
  parent:  'PAR',
  faculty: 'FAC',
  admin:   'ADM',
};

/** Next sequential human-readable ID for a role (e.g. "STU000042") — a
 *  registration-number-style identifier distinct from the Firebase Auth UID,
 *  assigned once and never reused. Generated via a Firestore counter
 *  transaction (one counter doc per role) so concurrent account creation
 *  never collides. */
export async function generateUniqueUserId(role: AuthRole): Promise<string> {
  const counterRef = doc(db, 'counters', `users_${role}`);
  const seq = await runTransaction(db, async tx => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists() ? (snap.data().seq as number) : 0) + 1;
    tx.set(counterRef, { seq: next }, { merge: true });
    return next;
  });
  return `${PREFIX[role]}${String(seq).padStart(6, '0')}`;
}
