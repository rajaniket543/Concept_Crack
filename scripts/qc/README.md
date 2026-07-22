# Question bank QC

Finds and fixes two problems in the live `questions` collection:

- **Wrong subject** — a Biology question stored with `subject: "Physics"`, so it
  surfaces in a Physics test. `src/lib/questions.ts` already re-checks `subject`
  after querying, so the query is not the bug: the stored field is.
- **Damaged content** — equations lost when `.doc` MathType objects were
  converted at import, truncated stems, empty or duplicated options, no answer key.

## Running it

Needs `scripts/service-account.json` (Firebase Console → Project settings →
Service accounts → Generate new private key). Not committed.

```bash
node scripts/qc/export.cjs      # one full read of the collection → data/questions.jsonl
node scripts/qc/audit.cjs       # offline analysis → data/report.txt, data/flagged.jsonl
node scripts/qc/apply.cjs       # dry run: shows what would change
```

`audit.cjs` touches no network, so re-run it freely while tuning thresholds —
only `export.cjs` costs Firestore reads.

When the report looks right:

```bash
node scripts/qc/apply.cjs --quarantine --go     # mark damaged questions qcBlocked
node scripts/qc/apply.cjs --fix-subjects --go   # apply high-confidence subject moves
```

Nothing is ever deleted. `--quarantine` only sets `qcBlocked: true`, which a
later clean run of the audit can clear.

## How a subject gets called wrong

Three independent signals, strongest first:

1. **Chapter consensus** — if 900 docs in "Human Reproduction" say Biology and 12
   say Physics, those 12 are wrong. Needs no dictionary and is near
   zero-false-positive; requires the chapter to have ≥20 docs at ≥90% agreement.
2. **Non-canonical value** — `subject: "Maths"` when the app only ever queries
   for `"Mathematics"` (see `STREAM_SUBJECTS` in `src/lib/stream.ts`). These
   questions are invisible to students rather than misplaced.
3. **Vocabulary** — subject-exclusive term lists scored over stem + options.
   Catches the case where the chapter is wrong too. Lower precision, so on its
   own it is only ever `medium` confidence → faculty review, never auto-applied.

Only `high` confidence (1 and 2, or 3 agreeing with one of them) is auto-applied.

## How broken math is detected

`audit.cjs` runs **the app's own KaTeX** over every `$…$` / `\(…\)` span. If it
throws there it renders broken in the exam too, so there are no false positives —
this is the same code path as `src/components/MathText.tsx`.

Alongside that: Word/OLE fingerprints (`EMBED Equation`, `MERGEFORMAT`,
`Equation.DSMT4`), Symbol-font glyph leakage, mojibake, unbalanced `$`, and
LaTeX commands sitting outside any delimiter (which never render).

## Verifying the answer keys

The audit above checks whether an answer *exists*. It cannot tell you whether
it's *correct* — and a confidently wrong key is the error that actually costs
students marks, because nothing about the question looks broken.

```bash
node scripts/qc/verify.cjs --pass 1        # solve everything with a cheap model
node scripts/qc/verify.cjs --pass 2        # re-solve only the disagreements
node scripts/qc/triage.cjs                 # combine both passes with the stored keys
node scripts/qc/apply.cjs --fix-answers    # dry run, then --go
```

Uses the same `VITE_GEMINI_API_KEY` from `.env.local` that the app uses — read
directly out of the file, nothing extra to configure.

**The model never sees the stored answer.** It solves cold and commits to a
letter, so agreement is real evidence instead of the model agreeing with
whatever it was shown. Two independent solves plus the stored key give:

| bucket | meaning |
|---|---|
| `CONFIRMED` | an independent solve landed on the stored key — nobody needs to look |
| `KEY_WRONG` | **both models agree with each other and against the key** — the output worth having |
| `REVIEW` | the two models split; genuinely hard or ambiguous, small pile |
| `KEY_FILLED` | no key on file, both models agree on one |
| `UNANSWERABLE` | a model returned `UNCLEAR` — broken in a way no regex catches |

Pass 2 only runs on pass-1 disagreements, which keeps the stronger model's cost
proportional to the problem rather than to the size of the bank.

### Running it free

Both default models are free-tier, and deliberately different ones — the
consensus logic needs two independent solvers, not one model asked twice:

| pass | model | free-tier quota |
|---|---|---|
| 1 | `gemini-flash-lite-latest` | ~15 RPM · ~1,000/day |
| 2 | `gemini-flash-latest` | ~10 RPM · ~250/day |

Pro is paid-only since April 2026 — the script refuses to start on a `pro` model
unless you pass `--paid`, rather than letting you discover it a day into a run.

The free tier caps **requests**, not tokens — so `--batch` is the lever that
matters. Ten questions per request turns a 1,000/day quota into 10,000
questions/day. Two daily runs:

```bash
node scripts/qc/verify.cjs --pass 1 --rpm 15 --batch 10 --limit 9500 --free
node scripts/qc/verify.cjs --pass 2 --rpm 10 --batch 3  --limit 700  --free
```

That puts a full 50k bank at roughly **five days for pass 1** and about a week
for pass 2 — call it two weeks end to end, free. Unbatched it would be months.

Runs are **resumable** — results append and finished ids are skipped — so this
is safe to run once a day until the pool is exhausted. `--free` swaps the dollar
meter for tokens and reports remaining work in *days* rather than dollars.

### What batching costs you

Attention. A model handed twenty problems reasons less about each one, so
`--batch` trades accuracy for throughput. The defaults split the difference:
**10 for pass 1** (wide, cheap screening) and **3 for pass 2** (careful
adjudication, and only ~15% of questions get there). Drop pass 2 to `--batch 1`
if the `REVIEW` pile comes back larger than you want to read.

Answers are matched back by the index the model echoes, never by array
position — a dropped or reordered entry would otherwise attach answers to the
wrong questions. Anything the model skips simply isn't written and gets picked
up on the next run.

On a **paid** key batching helps much less: it only amortises the instruction
prefix, and output tokens — the bulk of the bill — still scale per question.

With billing attached, the same commands finish in hours; only `--rpm` changes:

```bash
node scripts/qc/verify.cjs --pass 1 --rpm 900 --concurrency 20 --max-cost 60
```

Damaged questions are skipped automatically: a stem whose equation vanished at
import can't be solved by anyone, and its "disagreement" would say nothing about
the key. Run `audit.cjs` before `verify.cjs`.

`--fix-answers` writes corrections but sets `verificationStatus: 'pending'` and
keeps the old value in `qcAnswerWas` — model consensus is a strong signal, not a
verified one.

## Chemistry gets its own pass

Physics and Chemistry share nearly all of their prose vocabulary — energy, work,
heat, current, pressure, temperature, equilibrium — so the word lexicon is weak
on exactly that pair. Chemical formulae break the tie: a stem containing `KMnO4`
or `K2Cr2O7` is chemistry whatever the wording. Candidate formula tokens are
parsed into element symbols and validated against the periodic table, then a
capped bonus goes to Chemistry — capped so one incidental `H2O` in a
thermodynamics problem can't drag a physics question across.

The same parse catches formulae the `.doc` conversion mangled:

| flag | means |
|---|---|
| `chem_subscripts_stripped` | Word dropped a real subscript run — `H₂SO₄` arrived as `HSO`, still element-shaped and silently wrong |
| `chem_arrow_lost` | reaction arrow was a Symbol-font glyph and vanished, leaving `NaOH + HCl  NaCl + H2O` |
| `chem_charge_ambiguous` | `SO₄²⁻` collapsed to `SO42-`, where the subscript and the charge ran together |
| `chem_invalid_element` | formula-shaped token containing symbols that aren't elements — conversion garbage |

## Read the "worst origins" table first

The report ranks flag rate by `origin`. Bulk imports fail in bulk — if one
institute's batch is 60% damaged while everything else is at 2%, re-importing
that batch properly is a smaller job than repairing thousands of documents.
Same for the "chapters with a split subject" table: one bad mapping in the
importer, not 500 individually wrong questions.
