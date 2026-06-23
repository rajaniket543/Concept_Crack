import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AuthRole } from './auth';

interface DemoAccount {
  email:       string;
  password:    string;
  name:        string;
  role:        AuthRole;
  mobile:      string;
  permissions: string[];
  examTarget?: string;
  instituteId?: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email:       'student@prepmind.ai',
    password:    'Student@123',
    name:        'Arjun Sharma',
    role:        'student',
    mobile:      '+91 9876543210',
    permissions: [],
    examTarget:  'JEE 2025',
  },
  {
    email:       'parent@prepmind.ai',
    password:    'Parent@123',
    name:        'Meena Sharma',
    role:        'parent',
    mobile:      '+91 9876543211',
    permissions: [],
  },
  {
    email:       'faculty@prepmind.ai',
    password:    'Faculty@123',
    name:        'Dr. R. Iyer',
    role:        'faculty',
    mobile:      '+91 9876543212',
    permissions: ['manage_questions', 'view_batch'],
  },
  {
    email:       'admin@prepmind.ai',
    password:    'Admin@123',
    name:        'Admin Desk',
    role:        'admin',
    mobile:      '+91 9876543213',
    permissions: ['all'],
  },
];

export type SeedResult = {
  email:  string;
  role:   AuthRole;
  status: 'created' | 'exists' | 'error';
  error?: string;
};

export async function seedDemoAccounts(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const account of DEMO_ACCOUNTS) {
    try {
      // Try to create the Firebase Auth user
      const credential = await createUserWithEmailAndPassword(
        auth,
        account.email,
        account.password
      );

      // Write the Firestore user document
      await setDoc(doc(db, 'users', credential.user.uid), {
        name:        account.name,
        email:       account.email,
        mobile:      account.mobile,
        role:        account.role,
        status:      'Active',
        permissions: account.permissions,
        examTarget:  account.examTarget ?? null,
        instituteId: account.instituteId ?? null,
        createdAt:   serverTimestamp(),
        lastActive:  serverTimestamp(),
      });

      results.push({ email: account.email, role: account.role, status: 'created' });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') {
        // Account exists in Auth — make sure Firestore doc also exists
        results.push({ email: account.email, role: account.role, status: 'exists' });
      } else {
        results.push({
          email:  account.email,
          role:   account.role,
          status: 'error',
          error:  (err as Error).message,
        });
      }
    }
  }

  return results;
}

export async function isDemoSeeded(): Promise<boolean> {
  try {
    // Check if at least the student account Firestore doc exists
    // (Auth accounts exist if seeding completed before)
    const snap = await getDoc(doc(db, '_meta', 'seed'));
    return snap.exists() && snap.data()?.demoSeeded === true;
  } catch {
    return false;
  }
}

export async function markDemoSeeded() {
  await setDoc(doc(db, '_meta', 'seed'), {
    demoSeeded: true,
    seededAt:   serverTimestamp(),
  });
}
