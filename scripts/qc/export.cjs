// Step 1 — dump the whole `questions` collection to a local JSONL file.
//
// Everything downstream (audit.cjs) works on that file, so the collection is
// read exactly once no matter how many times the detectors are tuned and re-run.
//
//   node scripts/qc/export.cjs
//
// Needs scripts/service-account.json (Firebase Console → Project settings →
// Service accounts → Generate new private key).

const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const sa      = require('../service-account.json');
const DATA    = path.join(__dirname, 'data');
const OUT     = path.join(DATA, 'questions.jsonl');

initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  const out = fs.createWriteStream(OUT);

  let n = 0;
  // Paginated by document id so memory stays flat on a 50k+ collection.
  let cursor = null;
  const PAGE = 2000;

  for (;;) {
    let q = db.collection('questions').orderBy('__name__').limit(PAGE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      out.write(JSON.stringify({ id: doc.id, ...doc.data() }) + '\n');
      n++;
    }
    cursor = snap.docs[snap.docs.length - 1];
    process.stdout.write(`\r  exported ${n}…`);
    if (snap.size < PAGE) break;
  }

  out.end();
  console.log(`\n✓ ${n} questions → ${path.relative(process.cwd(), OUT)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
