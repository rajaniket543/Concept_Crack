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
