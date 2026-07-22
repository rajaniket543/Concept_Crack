// Step 4 — have Gemini solve each question independently and record its answer.
//
//   node scripts/qc/verify.cjs --pass 1 --rpm 15 --free              # free tier
//   node scripts/qc/verify.cjs --pass 1 --rpm 900 --concurrency 20   # billed
//   node scripts/qc/verify.cjs --pass 2 --rpm 15 --free              # disagreements only
//
// The model never sees the stored answer. It solves cold and commits to a
// letter, so agreement with the stored key is real evidence rather than the
// model agreeing with whatever it was shown.
//
// Output is append-only JSONL and every run skips ids already present, so this
// is safe to Ctrl-C and restart — useful on a free-tier key where a full sweep
// spans days.
//
// Questions the audit marked as damaged are skipped: a stem whose equation was
// lost at import cannot be solved by anyone, and its "disagreement" would say
// nothing about the answer key.

const fs   = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const QUESTIONS = path.join(DATA, 'questions.jsonl');
const FLAGGED   = path.join(DATA, 'flagged.jsonl');

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PASS        = Number(arg('pass', 1));
const RPM         = Number(arg('rpm', 15));
const CONCURRENCY = Number(arg('concurrency', Math.min(8, Math.ceil(RPM / 4))));
const LIMIT       = Number(arg('limit', 0));      // 0 = no cap
const MAX_COST    = Number(arg('max-cost', 0));   // 0 = no cap; USD
// Both defaults are free-tier models, and deliberately DIFFERENT ones: the
// consensus logic needs two independent solvers, not the same model asked
// twice. Flash is the stronger of the two, so it adjudicates.
//   pass 1  flash-lite  ~15 RPM / ~1,000 per day
//   pass 2  flash       ~10 RPM / ~250 per day
// Rolling `-latest` aliases for the same reason src/lib/ai.ts uses one: pinned
// versions get retired off free-tier keys and start returning 404.
const MODEL = arg('model', PASS === 1 ? 'gemini-flash-lite-latest' : 'gemini-flash-latest');

// Paid-only since 2026-04-01 — every request 429s on a free key, so say so
// before burning a day's quota discovering it.
if (/pro/.test(MODEL) && !args.includes('--paid')) {
  console.error(`${MODEL} is a paid-tier model. Either attach billing and re-run ` +
                `with --paid, or use a free model (gemini-flash-latest).`);
  process.exit(1);
}

// Questions per request. The free tier caps REQUESTS, not tokens, so this is
// the single biggest lever there: at 10 per request a 1,000/day quota covers
// 10,000 questions/day instead of 1,000. On a paid key the win is smaller —
// it only amortises the instruction prefix, and output tokens (the bulk of the
// bill) still scale per question.
//
// The cost is attention: a model handed 20 problems reasons less about each.
// Screen wide in pass 1, adjudicate carefully in pass 2 — hence the defaults.
const BATCH = Math.max(1, Number(arg('batch', PASS === 1 ? 10 : 3)));

// Thinking is billed as output and is drawn from the same maxOutputTokens
// budget — which is exactly the failure src/lib/ai.ts documents ("spending the
// whole budget on hidden reasoning… returns an empty answer"). Capping thinking
// explicitly leaves room for the answers to actually come back.
const THINKING_BUDGET = Number(arg('thinking-budget', 600 * BATCH));
const MAX_OUTPUT      = Number(arg('max-output', 900 * BATCH));

// USD per million tokens, standard (non-batch) tier, as published July 2026.
// Confirm against your own billing console before trusting a projection.
const PRICES = {
  'gemini-flash-lite-latest': { in: 0.25, out: 1.50 },
  'gemini-3.1-flash-lite':    { in: 0.25, out: 1.50 },
  'gemini-flash-latest':      { in: 0.50, out: 3.00 },
  'gemini-3-flash':           { in: 0.50, out: 3.00 },
  'gemini-3.1-pro':           { in: 2.00, out: 12.00 },
};
const PRICE = PRICES[MODEL] ?? { in: 0.50, out: 3.00 };
// On a free key nothing is billed, so a running dollar figure is just noise.
const FREE = args.includes('--free');

const OUT = path.join(DATA, `solved-pass${PASS}.jsonl`);

// ── Key ──────────────────────────────────────────────────────────────────────
// Same key the app uses — read straight out of .env.local so there is nothing
// extra to configure.

function readKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(__dirname, '..', '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const m = fs.readFileSync(envPath, 'utf8').match(/^VITE_GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  console.error('No API key. Set GEMINI_API_KEY or VITE_GEMINI_API_KEY in .env.local');
  process.exit(1);
}
const KEY = readKey();

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM = `You are an expert JEE/NEET examiner. Solve each multiple-choice question below and give the single correct option for each.

Work every problem out properly — do not pattern-match on which option looks plausible, and do not let a long list make you rush any individual question.

Answer "UNCLEAR" instead of guessing when a question cannot be answered as written: a formula or number is missing, it refers to a figure that is not present, no option is correct, or more than one option is correct. A wrong confident answer is far worse than an honest UNCLEAR.

Return exactly one entry per question, each carrying the index it was given.`;

// Gemini structured output — constrains the reply so there is nothing to parse
// out of prose. Always an array, even for a single question, so one code path
// handles every batch size.
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    answers: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index:      { type: 'INTEGER', description: 'The index shown with the question.' },
          answer:     { type: 'STRING', enum: ['A', 'B', 'C', 'D', 'UNCLEAR'] },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          note:       { type: 'STRING', description: 'One short sentence. Required when the answer is UNCLEAR.' },
        },
        required: ['index', 'answer', 'confidence'],
      },
    },
  },
  required: ['answers'],
};

function buildPrompt(chunk) {
  const body = chunk.map((q, n) => {
    const o = q.options ?? {};
    return `### Question ${n + 1}
Subject: ${q.subject ?? 'unknown'} · Chapter: ${q.chapter ?? 'unknown'}

${q.question}

(A) ${o.A ?? ''}
(B) ${o.B ?? ''}
(C) ${o.C ?? ''}
(D) ${o.D ?? ''}`;
  }).join('\n\n');

  return `${SYSTEM}\n\n${body}`;
}

// ── API ──────────────────────────────────────────────────────────────────────

async function solve(chunk) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    contents: [{ parts: [{ text: buildPrompt(chunk) }] }],
    generationConfig: {
      // src/lib/ai.ts sets thinkingBudget: 0 to keep the chat tutor snappy, but
      // a model that cannot work the problem through cannot tell us the answer
      // key is wrong. Budgeted rather than unbounded — see THINKING_BUDGET.
      thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 || res.status >= 500) {
    const e = new Error(`HTTP ${res.status}`);
    e.retryable = true;
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  const u = json.usageMetadata ?? {};
  if (!text) {
    // Almost always thinking consuming the whole output budget. Say so, rather
    // than reporting a bare "empty response" that looks like a network problem.
    throw new Error(`empty response (thoughts:${u.thoughtsTokenCount ?? '?'} ` +
                    `of ${MAX_OUTPUT} budget) — lower --batch or --thinking-budget`);
  }

  // Match answers back by the index the model echoes, never by array position —
  // a model that drops or reorders an entry would otherwise silently attach
  // answers to the wrong questions, which is worse than no verification at all.
  const parsed = JSON.parse(text).answers ?? [];
  const results = [];
  for (const a of parsed) {
    const q = chunk[Number(a.index) - 1];
    if (q) results.push({ q, ...a });
  }

  return {
    results,
    // thoughtsTokenCount is billed as output but reported separately, so it has
    // to be added in by hand or every projection comes out low.
    inTok:  u.promptTokenCount ?? 0,
    outTok: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
  };
}

/** Retries the transient failures (429 / 5xx) with widening backoff. */
async function solveWithRetry(chunk, attempts = 5) {
  let wait = 2000;
  for (let i = 0; i < attempts; i++) {
    try {
      return await solve(chunk);
    } catch (e) {
      if (!e.retryable || i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

// ── Load & select ────────────────────────────────────────────────────────────

if (!fs.existsSync(QUESTIONS)) {
  console.error(`Missing ${QUESTIONS}\nRun:  node scripts/qc/export.cjs`);
  process.exit(1);
}

const readJsonl = f => fs.existsSync(f)
  ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

const questions = readJsonl(QUESTIONS);

// Skip what the audit judged unsolvable — see the header note.
const damaged = new Set(
  readJsonl(FLAGGED)
    .filter(f => f.flags.some(x => x.startsWith('damage_') || x.startsWith('math_')
      || x.startsWith('chem_') || x.startsWith('stem_') || x.startsWith('option_')))
    .map(f => f.id));

const done = new Set(readJsonl(OUT).map(r => r.id));

let pool;
if (PASS === 1) {
  pool = questions.filter(q => !damaged.has(q.id));
} else {
  // Pass 2 re-solves only where pass 1 and the stored key disagreed — that is
  // the whole point of the two-pass split, and it is what keeps the cost of the
  // stronger model proportional to the problem rather than to the bank.
  const pass1 = new Map(readJsonl(path.join(DATA, 'solved-pass1.jsonl')).map(r => [r.id, r]));
  if (pass1.size === 0) {
    console.error('No solved-pass1.jsonl — run --pass 1 first.');
    process.exit(1);
  }
  pool = questions.filter(q => {
    const r = pass1.get(q.id);
    if (!r) return false;
    return r.answer !== (q.answer ?? null);
  });
}

// Chapters with the most questions are the ones tests actually draw from, so a
// partial run (a capped free-tier day) covers what students are most likely to
// see rather than an arbitrary slice.
const chapterSize = new Map();
for (const q of questions) {
  const k = (q.chapter ?? '').toLowerCase().trim();
  chapterSize.set(k, (chapterSize.get(k) || 0) + 1);
}
pool.sort((a, b) =>
  (chapterSize.get((b.chapter ?? '').toLowerCase().trim()) || 0) -
  (chapterSize.get((a.chapter ?? '').toLowerCase().trim()) || 0));

let todo = pool.filter(q => !done.has(q.id));
if (LIMIT > 0) todo = todo.slice(0, LIMIT);

const requests = Math.ceil(todo.length / BATCH);

console.log(`pass ${PASS} · model ${MODEL} · ${RPM} rpm · ${CONCURRENCY} workers · ${BATCH} q/request`);
console.log(`${questions.length} questions · ${damaged.size} skipped as damaged · ` +
            `${done.size} already solved · ${todo.length} to do`);
if (todo.length === 0) { console.log('nothing to do'); process.exit(0); }
console.log(`${requests} requests · est. ${(requests / RPM / 60).toFixed(1)} h at this rate\n`);

// ── Run ──────────────────────────────────────────────────────────────────────

const out = fs.createWriteStream(OUT, { flags: 'a' });
const minGap = 60000 / RPM;   // spacing that keeps the whole pool under the cap
let lastStart = 0;
let ok = 0, failed = 0, i = 0;
let inTok = 0, outTok = 0, stopped = false;

const cost = () => (inTok / 1e6) * PRICE.in + (outTok / 1e6) * PRICE.out;

async function worker() {
  for (;;) {
    if (stopped) return;
    const start = i;
    i += BATCH;
    const chunk = todo.slice(start, start + BATCH);
    if (chunk.length === 0) return;

    // Global spacing across workers — the rate limit counts requests, not
    // workers, so the gap has to be enforced here rather than per worker.
    const gap = lastStart + minGap - Date.now();
    if (gap > 0) await new Promise(r => setTimeout(r, gap));
    lastStart = Date.now();

    try {
      const r = await solveWithRetry(chunk);
      inTok += r.inTok;
      outTok += r.outTok;
      for (const a of r.results) {
        out.write(JSON.stringify({
          id: a.q.id,
          answer: a.answer,
          confidence: a.confidence,
          note: a.note ?? null,
          stored: a.q.answer ?? null,
          subject: a.q.subject ?? null,
          chapter: a.q.chapter ?? null,
          model: MODEL,
        }) + '\n');
      }
      ok += r.results.length;
      // Anything the model skipped is simply not written, so the next run picks
      // it up — no silent loss, no bookkeeping.
      const dropped = chunk.length - r.results.length;
      if (dropped > 0) failed += dropped;
    } catch (e) {
      failed += chunk.length;
      if (failed <= BATCH * 3) console.error(`\n  ${chunk[0].id} +${chunk.length - 1}: ${e.message}`);
    }

    // Hard stop. Finished work is already on disk and ids are skipped on the
    // next run, so hitting the cap costs nothing but the time already spent.
    if (MAX_COST > 0 && cost() >= MAX_COST && !stopped) {
      stopped = true;
      console.log(`\n\n⚠ stopping — spend cap $${MAX_COST} reached at ${ok} questions`);
      return;
    }

    const n = ok + failed;
    if (n % 25 === 0 || n === todo.length) {
      const meter = FREE
        ? `${(outTok / 1000).toFixed(0)}k out tokens`
        : `$${cost().toFixed(2)} spent · $${(cost() / Math.max(1, ok) * todo.length).toFixed(2)} projected`;
      process.stdout.write(`\r  ${n}/${todo.length}  ok:${ok} failed:${failed}  ${meter}   `);
    }
  }
}

Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
  out.end();
  const per = ok ? cost() / ok : 0;
  const remaining = pool.filter(q => !done.has(q.id)).length - ok;

  console.log(`\n✓ ${ok} solved, ${failed} failed → ${path.relative(process.cwd(), OUT)}`);
  console.log(`  ${inTok.toLocaleString()} in / ${outTok.toLocaleString()} out tokens` +
              (FREE ? '' : ` · $${cost().toFixed(2)} · $${(per * 1000).toFixed(2)} per 1,000 questions`));

  if (remaining > 0) {
    if (FREE && LIMIT > 0) {
      // The useful number on a free key is days-to-finish, not dollars.
      console.log(`  ${remaining} left ≈ ${Math.ceil(remaining / LIMIT)} more daily runs at --limit ${LIMIT}`);
    } else if (!FREE && ok) {
      console.log(`  ${remaining} left ≈ $${(per * remaining).toFixed(2)} to finish this pass`);
    } else {
      console.log(`  ${remaining} left in this pass`);
    }
  }
  if (failed) console.log('  re-run to retry the failures (finished ids are skipped)');
});
