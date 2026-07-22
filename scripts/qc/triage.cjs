// Step 5 — combine the two solve passes with the stored answer keys.
//
//   node scripts/qc/triage.cjs
//
// Two independent cold solves plus the stored key give three outcomes that
// matter, and they need very different handling:
//
//   CONFIRMED   both models agree with the stored key. Nobody needs to look.
//   KEY_WRONG   both models agree with EACH OTHER and against the stored key.
//               This is the output worth having — a question that looks perfect
//               and is marked wrong.
//   REVIEW      the models disagree with each other. Genuinely hard, ambiguous,
//               or subtly broken. Small pile, worth human eyes.
//
// Plus two side buckets: KEY_FILLED (no stored answer, models agree — free
// answer key) and UNANSWERABLE (a model said UNCLEAR, meaning the question is
// broken in a way no regex would catch).

const fs   = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const readJsonl = f => fs.existsSync(f)
  ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

const pass1 = new Map(readJsonl(path.join(DATA, 'solved-pass1.jsonl')).map(r => [r.id, r]));
const pass2 = new Map(readJsonl(path.join(DATA, 'solved-pass2.jsonl')).map(r => [r.id, r]));

if (pass1.size === 0) {
  console.error('No solved-pass1.jsonl — run:  node scripts/qc/verify.cjs --pass 1');
  process.exit(1);
}

const LETTERS = ['A', 'B', 'C', 'D'];
const buckets = { CONFIRMED: [], KEY_WRONG: [], REVIEW: [], KEY_FILLED: [], UNANSWERABLE: [] };

for (const [id, r1] of pass1) {
  const r2 = pass2.get(id);
  const stored = LETTERS.includes(r1.stored) ? r1.stored : null;
  const row = {
    id, subject: r1.subject, chapter: r1.chapter,
    stored, pass1: r1.answer, pass2: r2?.answer ?? null,
    confidence: r1.confidence, note: r1.note ?? r2?.note ?? null,
  };

  // A model refusing to answer says something a regex cannot: the question is
  // unanswerable as written even though it parses cleanly.
  if (r1.answer === 'UNCLEAR' || r2?.answer === 'UNCLEAR') {
    buckets.UNANSWERABLE.push(row);
    continue;
  }

  if (stored === null) {
    // No key on file. Consensus supplies one; a single opinion is not enough.
    if (r2 && r2.answer === r1.answer) buckets.KEY_FILLED.push({ ...row, suggested: r1.answer });
    else buckets.REVIEW.push(row);
    continue;
  }

  if (r1.answer === stored) {
    // Pass 1 agreed, so pass 2 never ran — an independent solve landing on the
    // stored key is the evidence we wanted.
    buckets.CONFIRMED.push(row);
    continue;
  }

  if (!r2) {
    // Disagreed in pass 1 but pass 2 has not run yet.
    buckets.REVIEW.push({ ...row, pending: true });
  } else if (r2.answer === r1.answer) {
    buckets.KEY_WRONG.push({ ...row, suggested: r1.answer });
  } else {
    // The two models split — including the case where pass 2 came back to the
    // stored key. Either way it is not a confident call.
    buckets.REVIEW.push(row);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

const L = [];
const say = s => { L.push(s); console.log(s); };
const total = pass1.size;
const pct = n => `${(n / total * 100).toFixed(1)}%`;

say('═'.repeat(70));
say(`ANSWER-KEY VERIFICATION — ${total} questions solved`);
say('═'.repeat(70));
say('');
say(`  CONFIRMED     ${String(buckets.CONFIRMED.length).padStart(6)}  ${pct(buckets.CONFIRMED.length).padStart(6)}  key matches an independent solve`);
say(`  KEY_WRONG     ${String(buckets.KEY_WRONG.length).padStart(6)}  ${pct(buckets.KEY_WRONG.length).padStart(6)}  both models agree the key is wrong`);
say(`  REVIEW        ${String(buckets.REVIEW.length).padStart(6)}  ${pct(buckets.REVIEW.length).padStart(6)}  models split — needs a human`);
say(`  KEY_FILLED    ${String(buckets.KEY_FILLED.length).padStart(6)}  ${pct(buckets.KEY_FILLED.length).padStart(6)}  had no key, models agree on one`);
say(`  UNANSWERABLE  ${String(buckets.UNANSWERABLE.length).padStart(6)}  ${pct(buckets.UNANSWERABLE.length).padStart(6)}  broken in a way the audit missed`);

// Per-subject error rate — the answer to "check every section". A subject far
// above the others usually means one bad import, not scattered mistakes.
say('\n── Wrong-key rate by subject ──');
const bySubject = {};
for (const [name, rows] of Object.entries(buckets)) {
  for (const r of rows) {
    const s = r.subject || '(none)';
    bySubject[s] ??= { total: 0, wrong: 0, review: 0 };
    bySubject[s].total++;
    if (name === 'KEY_WRONG') bySubject[s].wrong++;
    if (name === 'REVIEW') bySubject[s].review++;
  }
}
Object.entries(bySubject).sort((a, b) => (b[1].wrong / b[1].total) - (a[1].wrong / a[1].total))
  .forEach(([s, v]) => say(
    `  ${(v.wrong / v.total * 100).toFixed(1).padStart(5)}%  ` +
    `${String(v.wrong).padStart(5)}/${String(v.total).padEnd(6)}  ${s}`));

say('\n── Worst chapters (≥10 solved) ──');
const byChapter = {};
for (const [name, rows] of Object.entries(buckets)) {
  for (const r of rows) {
    const c = `${r.subject || '?'} · ${r.chapter || '(none)'}`;
    byChapter[c] ??= { total: 0, wrong: 0 };
    byChapter[c].total++;
    if (name === 'KEY_WRONG') byChapter[c].wrong++;
  }
}
Object.entries(byChapter).filter(([, v]) => v.total >= 10 && v.wrong > 0)
  .sort((a, b) => (b[1].wrong / b[1].total) - (a[1].wrong / a[1].total)).slice(0, 20)
  .forEach(([c, v]) => say(
    `  ${(v.wrong / v.total * 100).toFixed(1).padStart(5)}%  ` +
    `${String(v.wrong).padStart(4)}/${String(v.total).padEnd(5)}  ${c}`));

const pending = buckets.REVIEW.filter(r => r.pending).length;
if (pending) say(`\n⚠ ${pending} rows still need pass 2 — run:  node scripts/qc/verify.cjs --pass 2`);

fs.writeFileSync(path.join(DATA, 'triage-report.txt'), L.join('\n') + '\n');
for (const [name, rows] of Object.entries(buckets)) {
  fs.writeFileSync(path.join(DATA, `triage-${name.toLowerCase()}.jsonl`),
    rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

console.log(`\n✓ data/triage-report.txt + one .jsonl per bucket`);
