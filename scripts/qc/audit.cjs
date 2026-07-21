// Step 2 — audit the exported questions offline. Reads nothing from Firestore
// and writes nothing back, so it is free to re-run while tuning thresholds.
//
//   node scripts/qc/audit.cjs
//
// Produces:
//   data/report.txt    — human-readable summary, worst offenders first
//   data/flagged.jsonl — one line per problem question, with flags + suggested fix
//
// Two independent problem families are checked:
//   SUBJECT  — the doc's `subject` field disagrees with what the question is
//              actually about (a Biology question stored as Physics). This is the
//              only reason a Biology question can surface in a Physics test:
//              src/lib/questions.ts already re-checks `subject` after querying,
//              so the query is not at fault — the stored field is.
//   CONTENT  — the text itself is damaged: equations lost at import, truncated
//              stems, empty or duplicated options, missing answer key.

const fs    = require('fs');
const path  = require('path');
const katex = require('katex');

const DATA = path.join(__dirname, 'data');
const IN   = path.join(DATA, 'questions.jsonl');

// Subjects the app actually queries for — src/lib/stream.ts STREAM_SUBJECTS.
// Anything outside this set is invisible to students no matter how good it is.
const CANONICAL = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

// Common non-canonical spellings seen in bulk imports → what they should be.
const SUBJECT_ALIASES = {
  maths: 'Mathematics', math: 'Mathematics', mathematic: 'Mathematics',
  bio: 'Biology', botany: 'Biology', zoology: 'Biology',
  phy: 'Physics', physic: 'Physics',
  chem: 'Chemistry', chemisty: 'Chemistry',
};

// ── Subject lexicons ─────────────────────────────────────────────────────────
// Terms that are near-exclusive to one subject in a JEE/NEET context. Weight 3
// = decisive on its own, 1 = weak hint. Deliberately avoids shared vocabulary
// (energy, reaction, cell, field) which appears across subjects and would only
// add noise.
const LEXICON = {
  Biology: {
    3: ['mitochondri', 'chloroplast', 'ribosom', 'chromosom', 'genotype', 'phenotype',
        'meiosis', 'mitosis', 'photosynthesis', 'nephron', 'alveol', 'phylum',
        'gymnosperm', 'angiosperm', 'pollination', 'gametophyte', 'endosperm',
        'antibod', 'lymphocyte', 'neuron', 'hormone', 'enzyme', 'plasmid',
        'prokaryot', 'eukaryot', 'homeostasis', 'ecosystem', 'taxonom'],
    2: ['dna', 'rna', 'gene', 'protein', 'blood', 'tissue', 'organism', 'species',
        'bacteri', 'virus', 'plant', 'animal', 'digest', 'respirat', 'excret'],
  },
  Physics: {
    3: ['velocity', 'acceleration', 'momentum', 'capacitor', 'inductor', 'resistor',
        'refractive index', 'wavelength', 'amplitude', 'torque', 'friction',
        'projectile', 'kinetic energy', 'potential energy', 'magnetic field',
        'electric field', 'ohm', 'newton', 'joule', 'watt', 'tesla', 'weber',
        'photoelectric', 'de broglie', 'lens', 'mirror', 'interference',
        'diffraction', 'thermodynamic process', 'carnot', 'doppler'],
    2: ['force', 'mass', 'charge', 'current', 'voltage', 'circuit', 'wave',
        'frequency', 'displacement', 'gravity', 'pressure', 'work done'],
  },
  Chemistry: {
    3: ['orbital', 'hybridis', 'hybridiz', 'isomer', 'alkane', 'alkene', 'alkyne',
        'benzene', 'aldehyde', 'ketone', 'carboxyl', 'electrophil', 'nucleophil',
        'oxidation state', 'electronegativ', 'valence electron', 'periodic table',
        'stoichiometr', 'molarity', 'molality', 'normality', 'buffer solution',
        'lanthanide', 'actinide', 'coordination compound', 'ligand', 'colloid',
        'esterification', 'saponification', 'grignard'],
    2: ['mole', 'atom', 'molecule', 'bond', 'acid', 'base', 'salt', 'ph ',
        'catalyst', 'solution', 'compound', 'ion', 'electron', 'reaction'],
  },
  Mathematics: {
    3: ['integral', 'derivative', 'differentiat', 'matrix', 'determinant',
        'binomial', 'permutation', 'combination', 'probability', 'logarithm',
        'polynomial', 'quadratic equation', 'arithmetic progression',
        'geometric progression', 'hyperbola', 'parabola', 'ellipse', 'tangent to',
        'locus', 'vector product', 'scalar product', 'trigonometric', 'sin ', 'cos ',
        'complex number', 'limit of', 'continuity', 'differential equation'],
    2: ['equation', 'function', 'triangle', 'circle', 'angle', 'set of', 'value of x',
        'graph of', 'roots', 'series', 'sum of'],
  },
};

// ── Damage signatures ────────────────────────────────────────────────────────
// Word/MathType wreckage. These are the fingerprints of an OLE equation object
// that did not survive the .doc → text conversion.
const ARTIFACT_PATTERNS = [
  [/EMBED\s+Equation/i,            'ole_equation'],
  [/EMBED\s+\w+/i,                 'ole_object'],
  [/MERGEFORMAT/i,                 'word_field'],
  [/Equation\.DSMT|DSMT4/i,        'mathtype'],
  [/OLE_LINK|_Toc\d+/i,            'word_bookmark'],
  [/�/,                       'replacement_char'],   // lost character
  [/[-]/,              'symbol_font'],        // Symbol/Wingdings glyph
  [/Â|â€|Ã¢|Ã©/,                   'mojibake'],
  [/\{\\\*\\|\\rtf|\\par\b/,       'rtf_leftover'],
  [/<v:|<o:p|<!--\[if/i,           'html_leftover'],
];

// A stem that stops on an operator or a dangling word lost its tail at import.
const TRUNCATED_TAIL = /(?:[=+\-*/^_<>~±×÷]|\b(?:is|of|the|and|to|then|find|value|equal|if|where|when|between|calculate)\s*)[\s.:]*$/i;

// ── Chemistry ────────────────────────────────────────────────────────────────
// Chemical formulae are the single best Physics-vs-Chemistry discriminator.
// The two subjects share most of their prose vocabulary (energy, work, heat,
// current, pressure, temperature), so the lexicon alone is weak on that pair —
// but a stem containing H2SO4 or KMnO4 is chemistry regardless of wording.

const ELEMENTS = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe ' +
  'Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La ' +
  'Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra ' +
  'Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr').split(' '));

// A formula-shaped token: runs of Capital[lowercase][digits], optionally with
// parenthesised groups and a trailing charge.
const FORMULA_TOKEN = /\b(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+(?:\s*[\^]?\d*[+-])?\b/g;

/** Splits a candidate token into element symbols; null if it is not a formula. */
function parseFormula(tok) {
  const body = tok.replace(/[()^\s]/g, '').replace(/\d*[+-]$/, '');
  const parts = body.match(/[A-Z][a-z]?/g);
  if (!parts || parts.length === 0) return null;
  return parts;
}

function formulaTokens(text) {
  const found = [];
  for (const tok of text.match(FORMULA_TOKEN) || []) {
    // Needs a digit or 2+ element symbols to be a compound rather than a stray
    // capital letter — "A body of mass M" must not read as a formula.
    if (!/\d/.test(tok) && tok.length < 3) continue;
    const parts = parseFormula(tok);
    if (!parts) continue;
    found.push({ tok, parts, valid: parts.every(p => ELEMENTS.has(p)) });
  }
  return found;
}

// Common compounds with their subscripts stripped. Word drops subscript runs
// entirely when the .doc used real subscript formatting rather than plain
// digits, so H₂SO₄ arrives as "HSO" — still element-shaped, silently wrong.
const DIGIT_STRIPPED = {
  HSO: 'H2SO4', HPO: 'H3PO4', HNO: 'HNO3', HCO: 'H2CO3',
  NaOH: null, NaSO: 'Na2SO4', NaCO: 'Na2CO3', NaPO: 'Na3PO4',
  KMnO: 'KMnO4', KCrO: 'K2Cr2O7', KNO: 'KNO3',
  CaCO: 'CaCO3', CaOH: 'Ca(OH)2', CaSO: 'CaSO4', CaCl: 'CaCl2',
  MgCl: 'MgCl2', MgSO: 'MgSO4', AlO: 'Al2O3', AlCl: 'AlCl3',
  FeO: null, FeSO: 'FeSO4', FeCl: 'FeCl3', CuSO: 'CuSO4',
  NH: 'NH3', CH: 'CH4', CHOH: 'C2H5OH', CHO: null, CHCOOH: 'CH3COOH',
  ZnSO: 'ZnSO4', AgNO: 'AgNO3', BaCl: 'BaCl2', PbNO: 'Pb(NO3)2',
};

// Reaction arrows are Symbol-font glyphs in Word (® / ¾®) and vanish on
// conversion, leaving "A + B  C" — an equation with no reaction in it.
const ARROW = /→|⟶|⇌|⇋|↔|-->|->|=>|\\rightarrow|\\to\b|\\rightleftharpoons/;
const REACTION_WORDS = /\b(react|reaction|yields?|gives?|produces?|forms?|decomposes?|equation|prepared by|treated with)\b/i;

/** Chemistry-specific damage. Returns flag suffixes. */
function chemProblems(text, forms) {
  const out = [];

  for (const f of forms) {
    if (!f.valid) { out.push('invalid_element'); break; }
  }

  for (const f of forms) {
    const skeleton = f.tok.replace(/[\d()^\s+-]/g, '');
    if (Object.prototype.hasOwnProperty.call(DIGIT_STRIPPED, skeleton)
        && DIGIT_STRIPPED[skeleton] !== null
        && !/\d/.test(f.tok)) {
      out.push('subscripts_stripped');
      break;
    }
  }

  // "SO42-" is Word's rendering of SO₄²⁻ — the subscript and the charge ran
  // together and the reader cannot tell which digit is which.
  if (/\b[A-Z][a-z]?\d*[A-Z]?[a-z]?\d{2,}[+-]/.test(text)) out.push('charge_ambiguous');

  // An equation with reactants, no arrow, and reaction language around it.
  if (forms.length >= 2 && REACTION_WORDS.test(text) && !ARROW.test(text)
      && /\s\+\s/.test(text)) {
    out.push('arrow_lost');
  }

  return [...new Set(out)];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const norm = s => (s ?? '').toString().trim();
const lower = s => norm(s).toLowerCase();
/** Chapter names differ only by case/punctuation across imports — fold them. */
const chapterKey = s => lower(s).replace(/[^a-z0-9]+/g, ' ').trim();

function fullText(q) {
  const o = q.options ?? {};
  return [q.question, o.A, o.B, o.C, o.D, q.explanation]
    .filter(Boolean).join(' \n ');
}

/** Score text against every subject lexicon; returns sorted [subject, score]. */
function lexiconScores(text, forms = []) {
  const t = ' ' + lower(text) + ' ';
  const scores = {};
  for (const [subject, tiers] of Object.entries(LEXICON)) {
    let s = 0;
    for (const [weight, terms] of Object.entries(tiers)) {
      for (const term of terms) if (t.includes(term)) s += Number(weight);
    }
    scores[subject] = s;
  }

  // Real multi-element compounds push hard toward Chemistry — this is what
  // separates it from Physics, which shares nearly all of the prose vocabulary.
  // Capped so a single incidental H2O in a thermodynamics problem cannot
  // outvote an otherwise clearly-physics stem.
  const compounds = forms.filter(f => f.valid && f.parts.length >= 2);
  if (compounds.length) scores.Chemistry += Math.min(6, compounds.length * 2);

  return Object.entries(scores).sort((a, b) => b[1] - a[1]);
}

/**
 * Run the app's own KaTeX over every math span. If it throws here it renders
 * as broken text in the exam too — this is the same code path as
 * src/components/MathText.tsx, so there are no false positives.
 */
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

function mathProblems(text) {
  const out = [];
  MATH_RE.lastIndex = 0;
  let m;
  while ((m = MATH_RE.exec(text)) !== null) {
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (!tex) { out.push('empty_math'); continue; }
    try {
      katex.renderToString(tex, { throwOnError: true });
    } catch (e) {
      out.push('katex_error');
    }
  }
  // An odd number of $ means a delimiter was lost — the rest of the line is
  // then swallowed or rendered raw.
  const dollars = (text.match(/\$/g) || []).length;
  if (dollars % 2 === 1) out.push('unbalanced_dollar');
  const opens = (text.match(/\\\(/g) || []).length;
  const closes = (text.match(/\\\)/g) || []).length;
  if (opens !== closes) out.push('unbalanced_paren_math');
  // LaTeX commands sitting outside any delimiter never render.
  const bare = text.replace(MATH_RE, ' ');
  if (/\\(frac|sqrt|sum|int|alpha|beta|gamma|theta|lambda|Delta|pi|infty|cdot|times|rightarrow)\b/.test(bare)) {
    out.push('undelimited_latex');
  }
  return [...new Set(out)];
}

// ── Load ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(IN)) {
  console.error(`Missing ${IN}\nRun:  node scripts/qc/export.cjs`);
  process.exit(1);
}

const questions = fs.readFileSync(IN, 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

console.log(`Loaded ${questions.length} questions\n`);

// ── Pass 1: build the chapter → subject consensus ────────────────────────────
// A chapter like "Human Reproduction" holding 900 Biology docs and 12 Physics
// docs makes those 12 wrong with near-certainty. This is the highest-precision
// signal available and it needs no dictionary at all.

const chapterVotes = new Map(); // chapterKey → { subject → count, label }
for (const q of questions) {
  const ck = chapterKey(q.chapter);
  if (!ck) continue;
  if (!chapterVotes.has(ck)) chapterVotes.set(ck, { counts: {}, label: norm(q.chapter) });
  const v = chapterVotes.get(ck);
  const s = norm(q.subject) || '(none)';
  v.counts[s] = (v.counts[s] || 0) + 1;
}

const chapterConsensus = new Map(); // chapterKey → { subject, share, total }
for (const [ck, v] of chapterVotes) {
  const entries = Object.entries(v.counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, c]) => n + c, 0);
  const [top, topCount] = entries[0];
  chapterConsensus.set(ck, { subject: top, share: topCount / total, total, label: v.label });
}

// ── Pass 2: flag every question ──────────────────────────────────────────────

const flagged = [];
const tally = {};
const bump = k => { tally[k] = (tally[k] || 0) + 1; };

for (const q of questions) {
  const flags = [];
  let suggestedSubject = null;
  let confidence = null;

  const subject = norm(q.subject);
  const text = fullText(q);

  // — subject: not a value the app can ever query for —
  if (!subject) {
    flags.push('subject_missing');
  } else if (!CANONICAL.includes(subject)) {
    const alias = SUBJECT_ALIASES[lower(subject)];
    flags.push('subject_noncanonical');
    if (alias) { suggestedSubject = alias; confidence = 'high'; }
  }

  // — subject: disagrees with the rest of its own chapter —
  const cons = chapterConsensus.get(chapterKey(q.chapter));
  if (cons && subject && cons.subject !== subject && cons.total >= 20 && cons.share >= 0.9
      && CANONICAL.includes(cons.subject)) {
    flags.push('subject_vs_chapter');
    suggestedSubject = cons.subject;
    confidence = 'high';
  }

  // — subject: disagrees with its own vocabulary —
  const forms = formulaTokens(text);
  const [[topSubject, topScore], [, secondScore]] = lexiconScores(text, forms);
  if (subject && topScore >= 6 && topScore >= secondScore * 2 && topSubject !== subject) {
    flags.push('subject_vs_content');
    if (!suggestedSubject) { suggestedSubject = topSubject; confidence = 'medium'; }
    else if (suggestedSubject === topSubject) confidence = 'high';
  }

  // — content: import wreckage —
  for (const [re, name] of ARTIFACT_PATTERNS) if (re.test(text)) flags.push(`damage_${name}`);

  // — content: math that will not render —
  for (const p of mathProblems(text)) flags.push(`math_${p}`);

  // — content: chemical formulae mangled by the .doc conversion —
  for (const p of chemProblems(text, forms)) flags.push(`chem_${p}`);

  // — content: stem truncated or too short to be a question —
  const stem = norm(q.question);
  if (stem.length < 25) flags.push('stem_too_short');
  else if (TRUNCATED_TAIL.test(stem)) flags.push('stem_truncated');

  // — content: options unusable —
  const o = q.options ?? {};
  const keys = ['A', 'B', 'C', 'D'];
  const vals = keys.map(k => norm(o[k]));
  if (q.questionType !== 'numeric') {
    if (vals.some(v => !v)) flags.push('option_empty');
    else if (new Set(vals.map(lower)).size < 4) flags.push('option_duplicate');
  }

  // — content: no usable answer key —
  if (q.questionType !== 'numeric' && !keys.includes(norm(q.answer))) flags.push('answer_missing');

  // — content: refers to a figure it does not have —
  if (!q.imageUrl && /\b(figure|fig\.|diagram|graph shown|shown in the|adjoining)\b/i.test(stem)) {
    flags.push('figure_missing');
  }

  if (flags.length) {
    flags.forEach(bump);
    flagged.push({
      id: q.id,
      code: q.code ?? null,
      subject: subject || null,
      chapter: norm(q.chapter) || null,
      origin: q.origin ?? q.source ?? null,
      flags,
      suggestedSubject,
      confidence,
      preview: stem.slice(0, 160),
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

const L = [];
const say = s => { L.push(s); console.log(s); };

say('═'.repeat(70));
say(`QUESTION BANK AUDIT — ${questions.length} questions, ${flagged.length} flagged ` +
    `(${(flagged.length / questions.length * 100).toFixed(1)}%)`);
say('═'.repeat(70));

say('\n── Flags by frequency ──');
Object.entries(tally).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => say(`  ${String(v).padStart(6)}  ${k}`));

say('\n── Subject fixes, by confidence ──');
const high = flagged.filter(f => f.confidence === 'high' && f.suggestedSubject);
const med  = flagged.filter(f => f.confidence === 'medium' && f.suggestedSubject);
say(`  ${high.length} high confidence (safe to auto-apply)`);
say(`  ${med.length} medium confidence (send to faculty review)`);

const moves = {};
high.forEach(f => {
  const k = `${f.subject} → ${f.suggestedSubject}`;
  moves[k] = (moves[k] || 0) + 1;
});
Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 20)
  .forEach(([k, v]) => say(`      ${String(v).padStart(5)}  ${k}`));

say('\n── Worst origins (flag rate) ──');
// If one import batch is responsible for most of the damage, re-importing that
// batch properly beats fixing thousands of documents one at a time.
const byOrigin = {};
for (const q of questions) {
  const k = norm(q.origin ?? q.source) || '(none)';
  byOrigin[k] ??= { total: 0, bad: 0 };
  byOrigin[k].total++;
}
for (const f of flagged) {
  const k = f.origin || '(none)';
  if (byOrigin[k]) byOrigin[k].bad++;
}
Object.entries(byOrigin)
  .filter(([, v]) => v.total >= 50)
  .sort((a, b) => (b[1].bad / b[1].total) - (a[1].bad / a[1].total))
  .slice(0, 15)
  .forEach(([k, v]) =>
    say(`  ${(v.bad / v.total * 100).toFixed(1).padStart(5)}%  ${String(v.bad).padStart(6)}/${String(v.total).padEnd(6)}  ${k}`));

say('\n── Chapters with a split subject ──');
// A chapter whose docs disagree about their subject is usually one bad mapping
// in the importer rather than 500 individually wrong questions.
[...chapterVotes.entries()]
  .map(([ck, v]) => {
    const e = Object.entries(v.counts).sort((a, b) => b[1] - a[1]);
    const total = e.reduce((n, [, c]) => n + c, 0);
    return { label: v.label, e, total, minority: total - e[0][1] };
  })
  .filter(c => c.minority > 0 && c.total >= 20)
  .sort((a, b) => b.minority - a.minority)
  .slice(0, 25)
  .forEach(c => say(`  ${String(c.minority).padStart(5)} stray  ${c.label}  ` +
                    `[${c.e.map(([s, n]) => `${s}:${n}`).join(', ')}]`));

fs.writeFileSync(path.join(DATA, 'report.txt'), L.join('\n') + '\n');
fs.writeFileSync(path.join(DATA, 'flagged.jsonl'),
  flagged.map(f => JSON.stringify(f)).join('\n') + '\n');

console.log(`\n✓ data/report.txt · data/flagged.jsonl (${flagged.length} rows)`);
