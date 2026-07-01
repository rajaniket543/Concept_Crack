// Standalone seed script — run with: node seed.mjs
// Uses Firebase REST APIs directly (no browser required)

const API_KEY    = 'AIzaSyAh6QgSH9Y3Fp_wR_KMYrWVaNlshZj8ChM';
const PROJECT_ID = 'concept-crack';
const FIRESTORE  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE  = `https://identitytoolkit.googleapis.com/v1/accounts`;

// ── Firestore field encoder ───────────────────────────────────────────────────

function toField(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')  return { booleanValue: val };
  if (typeof val === 'number')   return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string')   return { stringValue: val };
  if (Array.isArray(val))        return { arrayValue: { values: val.map(toField) } };
  if (val instanceof Date)       return { timestampValue: val.toISOString() };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toField(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreBody(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toField(v);
  return { fields };
}

// ── Firebase Auth REST helpers ────────────────────────────────────────────────

async function createUser(email, password) {
  const res  = await fetch(`${AUTH_BASE}:signUp?key=${API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (json.error) {
    if (json.error.message === 'EMAIL_EXISTS') return null; // will sign in instead
    throw new Error(`Auth create error for ${email}: ${json.error.message}`);
  }
  return { uid: json.localId, token: json.idToken };
}

async function signIn(email, password) {
  const res  = await fetch(`${AUTH_BASE}:signInWithPassword?key=${API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Sign-in error for ${email}: ${json.error.message}`);
  return { uid: json.localId, token: json.idToken };
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

async function setDoc(collection, docId, data, token) {
  const url = `${FIRESTORE}/${collection}/${docId}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(toFirestoreBody(data)),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Firestore write error (${collection}/${docId}): ${JSON.stringify(json.error)}`);
  return json;
}

async function docExists(collection, docId, token) {
  const url = `${FIRESTORE}/${collection}/${docId}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const json = await res.json();
  return !json.error;
}

// ── Seeded pseudo-random ──────────────────────────────────────────────────────

function seeded(seed, min, max) {
  const s = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.round(min + s * (max - min));
}

// ── Demo accounts ─────────────────────────────────────────────────────────────

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

const JEE_IDS  = JEE_NAMES.map((_, i)  => `mock-jee-${String(i + 1).padStart(2, '0')}`);
const NEET_IDS = NEET_NAMES.map((_, i) => `mock-neet-${String(i + 1).padStart(2, '0')}`);

const DEMO_ACCOUNTS = [
  { email: 'student@prepmind.ai',  password: 'Student@123', name: 'Arjun Sharma',  role: 'student', mobile: '+91 9876543210', permissions: [], stream: 'JEE',  examTarget: 'JEE 2025' },
  { email: 'parent@prepmind.ai',   password: 'Parent@123',  name: 'Meena Sharma',  role: 'parent',  mobile: '+91 9876543211', permissions: [] },
  { email: 'faculty@prepmind.ai',  password: 'Faculty@123', name: 'Dr. R. Iyer',   role: 'faculty', mobile: '+91 9876543212', permissions: ['manage_questions', 'view_batch'], assignedStudents: JEE_IDS,  batchStream: 'JEE',  batchSize: 13 },
  { email: 'faculty2@prepmind.ai', password: 'Faculty@123', name: 'Dr. S. Menon',  role: 'faculty', mobile: '+91 9876543214', permissions: ['manage_questions', 'view_batch'], assignedStudents: NEET_IDS, batchStream: 'NEET', batchSize: 12 },
  { email: 'admin@prepmind.ai',    password: 'Admin@123',   name: 'Admin Desk',    role: 'admin',   mobile: '+91 9876543213', permissions: ['all'] },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🚀  Starting Concept Crack seed (v2)…\n');

  const uidMap   = {};
  let adminToken = null;

  // Step 1 — Create / sign-in each account
  for (const acct of DEMO_ACCOUNTS) {
    process.stdout.write(`  ${acct.email.padEnd(30)} `);
    try {
      let result = await createUser(acct.email, acct.password);
      let status = 'created';
      if (!result) {
        result = await signIn(acct.email, acct.password);
        status = 'exists';
      }
      uidMap[acct.email] = result.uid;
      if (acct.role === 'admin') adminToken = result.token;
      console.log(`✅  ${status}  (uid: ${result.uid})`);
    } catch (err) {
      console.log(`❌  ${err.message}`);
    }
  }

  if (!adminToken) {
    // Fall back to student token if admin login failed
    try {
      const s = await signIn('admin@prepmind.ai', 'Admin@123');
      adminToken = s.token;
    } catch {
      console.error('\n❌  Could not get any auth token. Aborting Firestore writes.');
      process.exit(1);
    }
  }

  console.log('\n📝  Writing Firestore user documents…\n');

  // Step 2 — Write Firestore docs for each account
  for (const acct of DEMO_ACCOUNTS) {
    const uid = uidMap[acct.email];
    if (!uid) continue;

    const extra = {};
    if (acct.stream)            extra.stream            = acct.stream;
    if (acct.examTarget)        extra.examTarget        = acct.examTarget;
    if (acct.assignedStudents)  extra.assignedStudents  = acct.assignedStudents;
    if (acct.batchStream)       extra.batchStream       = acct.batchStream;
    if (acct.batchSize)         extra.batchSize         = acct.batchSize;

    if (acct.role === 'parent') {
      extra.linkedStudentId = uidMap['student@prepmind.ai'] ?? null;
    }

    try {
      await setDoc('users', uid, {
        name:        acct.name,
        email:       acct.email,
        mobile:      acct.mobile,
        role:        acct.role,
        status:      'Active',
        permissions: acct.permissions,
        lastActive:  new Date(),
        ...extra,
      }, adminToken);
      console.log(`  users/${uid.slice(0, 12)}…   ✅  ${acct.email}`);
    } catch (err) {
      console.log(`  users/${uid.slice(0, 12)}…   ❌  ${err.message}`);
    }
  }

  console.log('\n👥  Writing 25 mock student documents…\n');

  // Step 3 — Write 25 mock student Firestore docs
  for (let i = 0; i < JEE_NAMES.length; i++) {
    const id    = JEE_IDS[i];
    const score = seeded(i * 31 + 7, 62, 96);
    const acc   = seeded(i * 17 + 3, 65, 95);
    const att   = seeded(i * 13 + 11, 82, 100);
    try {
      await setDoc('users', id, {
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
      }, adminToken);
      console.log(`  ${id.padEnd(20)} ✅  ${JEE_NAMES[i]}  (score: ${score}%, acc: ${acc}%)`);
    } catch (err) {
      console.log(`  ${id.padEnd(20)} ❌  ${err.message}`);
    }
  }

  for (let i = 0; i < NEET_NAMES.length; i++) {
    const id    = NEET_IDS[i];
    const score = seeded(i * 29 + 5, 60, 94);
    const acc   = seeded(i * 19 + 7, 63, 93);
    const att   = seeded(i * 11 + 13, 80, 100);
    try {
      await setDoc('users', id, {
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
      }, adminToken);
      console.log(`  ${id.padEnd(20)} ✅  ${NEET_NAMES[i]}  (score: ${score}%, acc: ${acc}%)`);
    } catch (err) {
      console.log(`  ${id.padEnd(20)} ❌  ${err.message}`);
    }
  }

  // Step 4 — Write seed meta
  console.log('\n🏷️   Writing seed metadata…');
  try {
    await setDoc('_meta', 'seed', {
      demoSeeded: true,
      version:    2,
      seededAt:   new Date(),
    }, adminToken);
    console.log('  _meta/seed             ✅\n');
  } catch (err) {
    console.log(`  _meta/seed             ❌  ${err.message}\n`);
  }

  console.log('✅  Seed complete!\n');
  console.log('Demo accounts:');
  console.log('  student@prepmind.ai   /  Student@123  (JEE stream)');
  console.log('  parent@prepmind.ai    /  Parent@123   (linked to Arjun Sharma)');
  console.log('  faculty@prepmind.ai   /  Faculty@123  (13 JEE students)');
  console.log('  faculty2@prepmind.ai  /  Faculty@123  (12 NEET students)');
  console.log('  admin@prepmind.ai     /  Admin@123');
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
