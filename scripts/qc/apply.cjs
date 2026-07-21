// Step 3 — write the audit's conclusions back to Firestore.
//
// Nothing is ever deleted. Damaged questions are marked `qcBlocked: true` so the
// app can skip them, which is reversible; a re-run of the audit after a fix
// clears the flag again.
//
//   node scripts/qc/apply.cjs                     # dry run — prints, writes nothing
//   node scripts/qc/apply.cjs --quarantine --go   # mark damaged questions
//   node scripts/qc/apply.cjs --fix-subjects --go # apply high-confidence subject moves
//
// Fields written:
//   qcFlags            string[]  every detector that fired
//   qcBlocked          boolean   content is broken — keep it out of student tests
//   qcSuggestedSubject string    what the audit thinks the subject should be
//   qcConfidence       string    'high' | 'medium'
//   qcCheckedAt        ISO date
//   subject            only with --fix-subjects, and only for high confidence
//   verificationStatus 'pending' so it surfaces in the faculty review queue

const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const sa = require('../service-account.json');
const IN = path.join(__dirname, 'data', 'flagged.jsonl');

const args        = process.argv.slice(2);
const GO          = args.includes('--go');
const QUARANTINE  = args.includes('--quarantine');
const FIX_SUBJECT = args.includes('--fix-subjects');

if (!QUARANTINE && !FIX_SUBJECT) {
  console.error('Pick at least one of --quarantine / --fix-subjects');
  process.exit(1);
}

initializeApp({ credential: cert(sa) });
const db = getFirestore();

const flagged = fs.readFileSync(IN, 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

// Content damage blocks a question from being served; a wrong subject does not
// (it just needs moving), so the two modes touch different sets.
const isDamage = f => f.flags.some(x => x.startsWith('damage_') || x.startsWith('math_')
  || x.startsWith('chem_') || x.startsWith('stem_') || x.startsWith('option_')
  || x === 'answer_missing');

const targets = flagged.filter(f =>
  (QUARANTINE && isDamage(f)) ||
  (FIX_SUBJECT && f.confidence === 'high' && f.suggestedSubject));

console.log(`${targets.length} documents to update` + (GO ? '' : '  (dry run — pass --go to write)'));

if (!GO) {
  targets.slice(0, 25).forEach(f =>
    console.log(`  ${f.id}  ${(f.subject ?? '-').padEnd(12)}` +
                `${f.suggestedSubject ? `→ ${f.suggestedSubject.padEnd(12)}` : ''.padEnd(15)}` +
                `${f.flags.join(',')}`));
  if (targets.length > 25) console.log(`  … ${targets.length - 25} more`);
  process.exit(0);
}

async function main() {
  const now = new Date().toISOString();
  let done = 0;

  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < targets.length; i += 400) {
    const chunk = targets.slice(i, i + 400);
    const batch = db.batch();

    for (const f of chunk) {
      const patch = {
        qcFlags: f.flags,
        qcCheckedAt: now,
        verificationStatus: 'pending',
      };
      if (f.suggestedSubject) {
        patch.qcSuggestedSubject = f.suggestedSubject;
        patch.qcConfidence = f.confidence;
      }
      if (QUARANTINE && isDamage(f)) patch.qcBlocked = true;
      if (FIX_SUBJECT && f.confidence === 'high' && f.suggestedSubject) {
        patch.subject = f.suggestedSubject;
        patch.qcSubjectWas = f.subject ?? null;
      }
      batch.update(db.collection('questions').doc(f.id), patch);
    }

    await batch.commit();
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${targets.length}`);
  }
  console.log('\n✓ done');
}

main().catch(e => { console.error(e); process.exit(1); });
