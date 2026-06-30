import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AuthRole } from './auth';

// ── Concept Crack full account roster ────────────────────────────────────────

interface CCStudent { firstName: string; lastName: string; }

const CC_JEE_STUDENTS: CCStudent[] = [
  { firstName: 'Arjun',     lastName: 'Sharma'   },
  { firstName: 'Rohan',     lastName: 'Mehta'    },
  { firstName: 'Vikram',    lastName: 'Singh'    },
  { firstName: 'Aditya',    lastName: 'Kumar'    },
  { firstName: 'Rahul',     lastName: 'Verma'    },
  { firstName: 'Karan',     lastName: 'Patel'    },
  { firstName: 'Siddharth', lastName: 'Joshi'    },
  { firstName: 'Nikhil',    lastName: 'Gupta'    },
  { firstName: 'Prateek',   lastName: 'Nair'     },
  { firstName: 'Akash',     lastName: 'Yadav'    },
  { firstName: 'Manish',    lastName: 'Tiwari'   },
  { firstName: 'Deepak',    lastName: 'Rajput'   },
  { firstName: 'Sumit',     lastName: 'Chauhan'  },
];

const CC_NEET_STUDENTS: CCStudent[] = [
  { firstName: 'Priya',   lastName: 'Patel'    },
  { firstName: 'Sneha',   lastName: 'Iyer'     },
  { firstName: 'Anjali',  lastName: 'Mishra'   },
  { firstName: 'Kavya',   lastName: 'Reddy'    },
  { firstName: 'Pooja',   lastName: 'Sharma'   },
  { firstName: 'Nisha',   lastName: 'Gupta'    },
  { firstName: 'Riya',    lastName: 'Jain'     },
  { firstName: 'Divya',   lastName: 'Nair'     },
  { firstName: 'Ananya',  lastName: 'Singh'    },
  { firstName: 'Shreya',  lastName: 'Kulkarni' },
  { firstName: 'Neha',    lastName: 'Bose'     },
  { firstName: 'Tanvi',   lastName: 'Desai'    },
];

export type CCAccountResult = {
  email:  string;
  role:   AuthRole;
  name:   string;
  status: 'created' | 'exists' | 'error';
  error?: string;
  uid?:   string;
};

// ── Mock student names ────────────────────────────────────────────────────────

const JEE_NAMES = [
  'Aryan Kapoor', 'Rohan Verma', 'Priya Singh', 'Karan Mehta', 'Sneha Gupta',
  'Vikram Nair', 'Ananya Joshi', 'Rahul Sharma', 'Deepika Patel', 'Aditya Kumar',
  'Meera Iyer', 'Nikhil Rao', 'Shruti Dubey',
];

const NEET_NAMES = [
  'Pooja Reddy', 'Ravi Shankar', 'Kavya Pillai', 'Suresh Nambiar', 'Divya Menon',
  'Harish Balaji', 'Lakshmi Krishnan', 'Tarun Chandra', 'Aparna Nair', 'Sanjay Bhat',
  'Rekha Subramaniam', 'Girish Kamath',
];

const JEE_STUDENT_IDS  = JEE_NAMES.map((_, i)  => `mock-jee-${String(i + 1).padStart(2, '0')}`);
const NEET_STUDENT_IDS = NEET_NAMES.map((_, i) => `mock-neet-${String(i + 1).padStart(2, '0')}`);

function seeded(seed: number, min: number, max: number) {
  const s = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.round(min + s * (max - min));
}

// ── Demo accounts ─────────────────────────────────────────────────────────────

interface DemoAccount {
  email:       string;
  password:    string;
  name:        string;
  role:        AuthRole;
  mobile:      string;
  permissions: string[];
  examTarget?: string;
  stream?:     string;
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
    stream:      'JEE',
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
    email:       'faculty2@prepmind.ai',
    password:    'Faculty@123',
    name:        'Dr. S. Menon',
    role:        'faculty',
    mobile:      '+91 9876543214',
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

// ── Helper: find UID for an existing auth account via Firestore email query ──

async function findUidByEmail(email: string): Promise<string | null> {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].id;
  } catch {
    return null;
  }
}

// ── Main seed function ────────────────────────────────────────────────────────

export async function seedDemoAccounts(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  const uidMap: Record<string, string> = {};

  // Step 1: Create / confirm Firebase Auth accounts and collect UIDs
  for (const account of DEMO_ACCOUNTS) {
    let uid: string | null = null;

    try {
      const credential = await createUserWithEmailAndPassword(auth, account.email, account.password);
      uid = credential.user.uid;
      results.push({ email: account.email, role: account.role, status: 'created' });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') {
        uid = await findUidByEmail(account.email);
        results.push({ email: account.email, role: account.role, status: 'exists' });
      } else {
        results.push({ email: account.email, role: account.role, status: 'error', error: (err as Error).message });
        continue;
      }
    }

    if (!uid) continue;
    uidMap[account.email] = uid;

    // Build role-specific extra fields
    const extra: Record<string, unknown> = {};
    if (account.stream)   extra.stream     = account.stream;
    if (account.examTarget) extra.examTarget = account.examTarget;

    if (account.email === 'parent@prepmind.ai') {
      extra.linkedStudentId = uidMap['student@prepmind.ai'] ?? null;
    }
    if (account.email === 'faculty@prepmind.ai') {
      extra.assignedStudents = JEE_STUDENT_IDS;
      extra.batchStream      = 'JEE';
      extra.batchSize        = 13;
    }
    if (account.email === 'faculty2@prepmind.ai') {
      extra.assignedStudents = NEET_STUDENT_IDS;
      extra.batchStream      = 'NEET';
      extra.batchSize        = 12;
    }

    await setDoc(doc(db, 'users', uid), {
      name:        account.name,
      email:       account.email,
      mobile:      account.mobile,
      role:        account.role,
      status:      'Active',
      permissions: account.permissions,
      ...extra,
      lastActive: serverTimestamp(),
    }, { merge: true });
  }

  // Step 2: If parent was found but student UID wasn't captured yet, fix the link
  const parentUid  = uidMap['parent@prepmind.ai'];
  const studentUid = uidMap['student@prepmind.ai'];
  if (parentUid && studentUid) {
    await setDoc(doc(db, 'users', parentUid), { linkedStudentId: studentUid }, { merge: true });
  }

  // Step 3: Create 25 mock student Firestore docs (no Firebase Auth)
  for (let i = 0; i < JEE_NAMES.length; i++) {
    const id    = JEE_STUDENT_IDS[i];
    const score = seeded(i * 31 + 7, 62, 96);
    const acc   = seeded(i * 17 + 3, 65, 95);
    const att   = seeded(i * 13 + 11, 82, 100);
    const snap  = await getDoc(doc(db, 'users', id));
    if (!snap.exists()) {
      await setDoc(doc(db, 'users', id), {
        name:        JEE_NAMES[i],
        email:       `${id}@demo.conceptcrack.app`,
        role:        'student',
        stream:      'JEE',
        examTarget:  'JEE 2025',
        score,
        accuracy:    acc,
        attendance:  att,
        rank:        i + 1,
        status:      'Active',
        permissions: [],
        createdAt:   serverTimestamp(),
        lastActive:  serverTimestamp(),
      });
    }
  }

  for (let i = 0; i < NEET_NAMES.length; i++) {
    const id    = NEET_STUDENT_IDS[i];
    const score = seeded(i * 29 + 5, 60, 94);
    const acc   = seeded(i * 19 + 7, 63, 93);
    const att   = seeded(i * 11 + 13, 80, 100);
    const snap  = await getDoc(doc(db, 'users', id));
    if (!snap.exists()) {
      await setDoc(doc(db, 'users', id), {
        name:        NEET_NAMES[i],
        email:       `${id}@demo.conceptcrack.app`,
        role:        'student',
        stream:      'NEET',
        examTarget:  'NEET 2025',
        score,
        accuracy:    acc,
        attendance:  att,
        rank:        i + 1,
        status:      'Active',
        permissions: [],
        createdAt:   serverTimestamp(),
        lastActive:  serverTimestamp(),
      });
    }
  }

  return results;
}

// ── Full Concept Crack seed (53 accounts) ─────────────────────────────────────

export async function seedConceptCrackAccounts(
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<CCAccountResult[]> {
  const results: CCAccountResult[] = [];
  const jeeStudentUids: string[] = [];
  const neetStudentUids: string[] = [];
  const TOTAL = 1 + CC_JEE_STUDENTS.length * 2 + CC_NEET_STUDENTS.length * 2 + 2;
  let done = 0;

  async function createOne(
    email: string,
    firestoreData: Record<string, unknown>,
    role: AuthRole,
    name: string,
  ): Promise<string | null> {
    let uid: string | null = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, 'Temp@1234');
      uid = cred.user.uid;
      results.push({ email, role, name, status: 'created', uid });
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') {
        uid = await findUidByEmail(email);
        results.push({ email, role, name, status: 'exists', uid: uid ?? undefined });
      } else {
        results.push({ email, role, name, status: 'error', error: (err as Error).message });
        done++;
        onProgress?.(done, TOTAL, name);
        return null;
      }
    }
    if (uid) await setDoc(doc(db, 'users', uid), firestoreData, { merge: true });
    done++;
    onProgress?.(done, TOTAL, name);
    return uid;
  }

  // Admin
  await createOne('admin@conceptcrack.in', {
    name: 'Admin Desk', email: 'admin@conceptcrack.in', role: 'admin',
    status: 'Active', permissions: ['all'], mustChangePassword: true,
    createdAt: serverTimestamp(), lastActive: serverTimestamp(),
  }, 'admin', 'Admin Desk');

  // JEE students
  for (const s of CC_JEE_STUDENTS) {
    const fn    = s.firstName.toLowerCase();
    const email = `student.${fn}@conceptcrack.in`;
    const uid   = await createOne(email, {
      name: `${s.firstName} ${s.lastName}`, email, role: 'student',
      stream: 'JEE', examTarget: 'JEE 2025', status: 'Active',
      permissions: [], mustChangePassword: true,
      createdAt: serverTimestamp(), lastActive: serverTimestamp(),
    }, 'student', `${s.firstName} ${s.lastName}`);
    if (uid) jeeStudentUids.push(uid);
  }

  // NEET students
  for (const s of CC_NEET_STUDENTS) {
    const fn    = s.firstName.toLowerCase();
    const email = `student.${fn}@conceptcrack.in`;
    const uid   = await createOne(email, {
      name: `${s.firstName} ${s.lastName}`, email, role: 'student',
      stream: 'NEET', examTarget: 'NEET 2025', status: 'Active',
      permissions: [], mustChangePassword: true,
      createdAt: serverTimestamp(), lastActive: serverTimestamp(),
    }, 'student', `${s.firstName} ${s.lastName}`);
    if (uid) neetStudentUids.push(uid);
  }

  // JEE parents (linked to their child)
  for (let i = 0; i < CC_JEE_STUDENTS.length; i++) {
    const s    = CC_JEE_STUDENTS[i];
    const sUid = jeeStudentUids[i];
    const fn   = s.firstName.toLowerCase();
    const email = `parent.${fn}@conceptcrack.in`;
    const pUid  = await createOne(email, {
      name: `Parent of ${s.firstName} ${s.lastName}`, email, role: 'parent',
      linkedStudentId: sUid ?? null, status: 'Active',
      permissions: [], mustChangePassword: true,
      createdAt: serverTimestamp(), lastActive: serverTimestamp(),
    }, 'parent', `Parent of ${s.firstName} ${s.lastName}`);
    if (pUid && sUid) {
      await setDoc(doc(db, 'users', sUid), { parentId: pUid }, { merge: true });
    }
  }

  // NEET parents
  for (let i = 0; i < CC_NEET_STUDENTS.length; i++) {
    const s    = CC_NEET_STUDENTS[i];
    const sUid = neetStudentUids[i];
    const fn   = s.firstName.toLowerCase();
    const email = `parent.${fn}@conceptcrack.in`;
    const pUid  = await createOne(email, {
      name: `Parent of ${s.firstName} ${s.lastName}`, email, role: 'parent',
      linkedStudentId: sUid ?? null, status: 'Active',
      permissions: [], mustChangePassword: true,
      createdAt: serverTimestamp(), lastActive: serverTimestamp(),
    }, 'parent', `Parent of ${s.firstName} ${s.lastName}`);
    if (pUid && sUid) {
      await setDoc(doc(db, 'users', sUid), { parentId: pUid }, { merge: true });
    }
  }

  // JEE faculty
  const jeeEmail = 'faculty.rajesh@conceptcrack.in';
  const jeeUid   = await createOne(jeeEmail, {
    name: 'Dr. Rajesh Kumar', email: jeeEmail, role: 'faculty',
    facultyStream: 'JEE', assignedStudents: jeeStudentUids,
    batchSize: jeeStudentUids.length, status: 'Active',
    permissions: ['manage_questions', 'view_batch'], mustChangePassword: true,
    createdAt: serverTimestamp(), lastActive: serverTimestamp(),
  }, 'faculty', 'Dr. Rajesh Kumar');

  // NEET faculty
  const neetEmail = 'faculty.meera@conceptcrack.in';
  const neetUid   = await createOne(neetEmail, {
    name: 'Dr. Meera Iyer', email: neetEmail, role: 'faculty',
    facultyStream: 'NEET', assignedStudents: neetStudentUids,
    batchSize: neetStudentUids.length, status: 'Active',
    permissions: ['manage_questions', 'view_batch'], mustChangePassword: true,
    createdAt: serverTimestamp(), lastActive: serverTimestamp(),
  }, 'faculty', 'Dr. Meera Iyer');

  // Stamp facultyId on every student
  if (jeeUid) {
    await Promise.all(jeeStudentUids.map(uid =>
      setDoc(doc(db, 'users', uid), { facultyId: jeeUid }, { merge: true }),
    ));
  }
  if (neetUid) {
    await Promise.all(neetStudentUids.map(uid =>
      setDoc(doc(db, 'users', uid), { facultyId: neetUid }, { merge: true }),
    ));
  }

  await setDoc(doc(db, '_meta', 'seed'), {
    conceptCrackSeeded: true,
    conceptCrackSeededAt: serverTimestamp(),
    version: 3,
  }, { merge: true });

  return results;
}

export async function isConceptCrackSeeded(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, '_meta', 'seed'));
    return snap.exists() && snap.data()?.conceptCrackSeeded === true;
  } catch {
    return false;
  }
}

// ── Original 4-account demo seed ─────────────────────────────────────────────

export async function isDemoSeeded(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, '_meta', 'seed'));
    if (!snap.exists()) return false;
    const d = snap.data();
    // version 2 adds mock students + faculty2 + parent links
    return d?.demoSeeded === true && (d?.version ?? 1) >= 2;
  } catch {
    return false;
  }
}

export async function markDemoSeeded() {
  await setDoc(doc(db, '_meta', 'seed'), {
    demoSeeded:  true,
    seededAt:    serverTimestamp(),
    version:     2,
  });
}
