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
const FIX_ANSWER  = args.includes('--fix-answers');

if (!QUARANTINE && !FIX_SUBJECT && !FIX_ANSWER) {
  console.error('Pick at least one of --quarantine / --fix-subjects / --fix-answers');
  process.exit(1);
}

initializeApp({ credential: cert(sa) });
const db = getFirestore();

const readJsonl = f => fs.existsSync(f)
  ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

const flagged = readJsonl(IN);

// Content damage blocks a question from being served; a wrong subject does not
// (it just needs moving), so the two modes touch different sets.
const isDamage = f => f.flags.some(x => x.startsWith('damage_') || x.startsWith('math_')
  || x.startsWith('chem_') || x.startsWith('stem_') || x.startsWith('option_')
  || x === 'answer_missing');

const targets = flagged.filter(f =>
  (QUARANTINE && isDamage(f)) ||
  (FIX_SUBJECT && f.confidence === 'high' && f.suggestedSubject));

// Answer corrections come from triage, not the audit — both models had to agree
// against the stored key (or supply one where none existed).
const answers = FIX_ANSWER
  ? [...readJsonl(path.join(__dirname, 'data', 'triage-key_wrong.jsonl')),
     ...readJsonl(path.join(__dirname, 'data', 'triage-key_filled.jsonl'))]
      .filter(r => r.suggested)
  : [];

console.log(`${targets.length} flag updates · ${answers.length} answer corrections` +
            (GO ? '' : '  (dry run — pass --go to write)'));

if (!GO) {
  targets.slice(0, 15).forEach(f =>
    console.log(`  ${f.id}  ${(f.subject ?? '-').padEnd(12)}` +
                `${f.suggestedSubject ? `→ ${f.suggestedSubject.padEnd(12)}` : ''.padEnd(15)}` +
                `${f.flags.join(',')}`));
  if (targets.length > 15) console.log(`  … ${targets.length - 15} more`);
  answers.slice(0, 15).forEach(r =>
    console.log(`  ${r.id}  answer ${String(r.stored ?? '—').padEnd(3)} → ${r.suggested}   ${r.subject ?? ''} · ${r.chapter ?? ''}`));
  if (answers.length > 15) console.log(`  … ${answers.length - 15} more`);
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
    process.stdout.write(`\r  flags ${done}/${targets.length}`);
  }

  let fixed = 0;
  for (let i = 0; i < answers.length; i += 400) {
    const chunk = answers.slice(i, i + 400);
    const batch = db.batch();

    for (const r of chunk) {
      batch.update(db.collection('questions').doc(r.id), {
        answer: r.suggested,
        qcAnswerWas: r.stored ?? null,
        qcAnswerSource: 'model-consensus',
        qcCheckedAt: now,
        // Faculty still sees it in the review queue — a corrected key is a
        // strong signal, not a verified one.
        verificationStatus: 'pending',
      });
      fixed++;
    }

    await batch.commit();
    process.stdout.write(`\r  answers ${fixed}/${answers.length}`);
  }
  console.log('\n✓ done');
}

main().catch(e => { console.error(e); process.exit(1); });
