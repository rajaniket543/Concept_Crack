// Convert the eQOURSE/jee-main-questions HuggingFace dataset into the app's
// question schema, ready for import_firestore.py.
//
//   node scripts/qc/build_from_hf.cjs
//
// Pages the HuggingFace rows API (no parquet reader, no pip installs) across all
// three subject configs, maps each row to the Firestore shape the app reads, and
// writes output/all_questions.json ready for import_firestore.py.
//
// Figures: the dataset's images live in the same HF repo and are served at a
// public URL, so imageUrl points straight at HF — no Firebase Storage / Blaze
// plan needed to show diagrams. That URL is a hotlink to someone else's host:
// fine for this test bank, but for production the images should be downloaded
// and re-hosted (Storage/CDN) so the bank can't break if the dataset moves.
//
// Everything is tagged stream:"JEE" — this dataset is JEE Main only.

const fs   = require('fs');
const path = require('path');

const DATASET  = 'eQOURSE/jee-main-questions';
const CONFIGS  = ['physics', 'chemistry', 'mathematics'];
const SPLITS   = ['train', 'test'];
const OUT_DIR  = path.join(__dirname, '..', 'output');
const PAGE     = 100;
const IMG_BASE = `https://huggingface.co/datasets/${DATASET}/resolve/main`;

const LETTER = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };

// HF difficulty labels → the app's three-value scale.
function difficulty(d) {
  const s = (d || '').toLowerCase();
  if (s.startsWith('easy')) return 'Easy';
  if (s.startsWith('tough') || s.startsWith('hard')) return 'Hard';
  return 'Medium'; // "Moderate" and anything unlabelled
}

// "P-20-Q7" / source "P-24 …" → 2020 / 2024.
function yearFrom(qid) {
  const m = (qid || '').match(/-(\d{2})-/);
  if (!m) return null;
  const yy = Number(m[1]);
  return 2000 + yy;
}

async function fetchPage(config, split, offset) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}`
    + `&config=${config}&split=${split}&offset=${offset}&length=${PAGE}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`HTTP ${res.status} on ${config}/${split}@${offset}`);
  }
  throw new Error(`gave up on ${config}/${split}@${offset}`);
}

/** Turn a dataset-relative image path ('images/imageN.png') into a public HF URL. */
function imgUrl(config, rel) {
  return `${IMG_BASE}/${config}/${rel.replace(/^\/+/, '')}`;
}

function mapRow(r, config) {
  const opts = {
    A: (r.option_1 ?? '').trim(),
    B: (r.option_2 ?? '').trim(),
    C: (r.option_3 ?? '').trim(),
    D: (r.option_4 ?? '').trim(),
  };

  const type = r.question_type || 'single_correct';
  let questionType = 'single';
  let answer = null;
  let numericalAnswer = null;

  if (type === 'numerical' || (r.numerical_answer != null && String(r.numerical_answer).trim() && String(r.numerical_answer) !== 'None')) {
    questionType = 'numeric';
    numericalAnswer = String(r.numerical_answer).trim();
  } else if (type === 'multi_correct') {
    questionType = 'multiple';
    answer = LETTER[r.correct_option] ?? null; // dataset stores one index; flag on review
  } else {
    answer = LETTER[r.correct_option] ?? null;
  }

  // Only a figure attached to the QUESTION blocks answering. An image that
  // appears only in the solution doesn't stop a student solving it, so it never
  // holds the question back.
  const qImgs = (Array.isArray(r.question_images) ? r.question_images : []).filter(Boolean);
  const sImgs = (Array.isArray(r.solution_images) ? r.solution_images : []).filter(Boolean);
  const imageUrl = qImgs.length ? imgUrl(config, qImgs[0]) : null;

  return {
    doc: {
      question:    (r.question ?? '').trim(),
      options:     opts,
      answer,                                    // A|B|C|D or null (numeric)
      ...(numericalAnswer ? { numericalAnswer } : {}),
      questionType,
      difficulty:  difficulty(r.difficulty),
      subject:     (r.subject ?? '').trim(),     // Physics | Chemistry | Mathematics
      chapter:     (r.topic ?? '').trim(),       // topic → chapter
      topic:       (r.subtopic ?? '').trim(),    // subtopic → topic
      stream:      'JEE',                         // dataset is JEE Main only
      origin:      'JEE Main PYQ',
      source:      'JEE Main PYQ',
      isPYQ:       true,
      year:        yearFrom(r.question_id),
      ...(imageUrl ? { imageUrl } : {}),
      ...(qImgs.length > 1 ? { extraImageUrls: qImgs.slice(1).map(p => imgUrl(config, p)) } : {}),
      ...(sImgs.length ? { solutionImageUrls: sImgs.map(p => imgUrl(config, p)) } : {}),
      explanation: (r.solution ?? '').replace(/\[IMAGE\]/g, '').trim(),
      externalId:  r.question_id ?? null,
      sourcePaper: r.source_paper ?? null,
      createdAt:   new Date().toISOString(),
    },
    needsFigure: qImgs.length > 0,
    multiFigure: qImgs.length > 1,
    type,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = [];
  const bySubject = {};
  const byType = {};
  let total = 0, withFigure = 0, multiFigure = 0;

  for (const config of CONFIGS) {
    for (const split of SPLITS) {
      let offset = 0;
      for (;;) {
        const data = await fetchPage(config, split, offset);
        const rows = data.rows ?? [];
        if (rows.length === 0) break;
        for (const { row } of rows) {
          total++;
          const { doc, needsFigure, multiFigure: mf, type } = mapRow(row, config);
          byType[type] = (byType[type] || 0) + 1;
          const subj = doc.subject || '(none)';
          bySubject[subj] ??= { total: 0, kept: 0, figure: 0, noAnswer: 0 };
          bySubject[subj].total++;

          // No usable answer key → useless for a bank; drop, don't import blind.
          if (doc.questionType !== 'numeric' && !doc.answer) {
            bySubject[subj].noAnswer++;
            continue;
          }
          out.push(doc);
          bySubject[subj].kept++;
          if (needsFigure) { withFigure++; bySubject[subj].figure++; }
          if (mf) multiFigure++;
        }
        process.stdout.write(`\r  ${config}/${split}: ${offset + rows.length}`);
        offset += rows.length;
        if (rows.length < PAGE) break;
        await new Promise(r => setTimeout(r, 300)); // be gentle on the API
      }
      process.stdout.write('\n');
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'all_questions.json'), JSON.stringify(out, null, 2));

  console.log('\n' + '═'.repeat(64));
  console.log(`Fetched ${total} rows · ${out.length} importable (incl. ${withFigure} with a figure) · ` +
              `${total - out.length} dropped (no answer key)`);
  console.log('─'.repeat(64));
  console.log('subject        total    kept  w/figure  no-answer');
  for (const [s, v] of Object.entries(bySubject)) {
    console.log(`  ${s.padEnd(12)} ${String(v.total).padStart(5)} ${String(v.kept).padStart(7)} ${String(v.figure).padStart(9)} ${String(v.noAnswer).padStart(9)}`);
  }
  console.log('─'.repeat(64));
  console.log('question types:', JSON.stringify(byType));
  if (multiFigure) console.log(`note: ${multiFigure} questions have >1 figure — first shown as imageUrl, rest in extraImageUrls`);
  console.log(`\n✓ output/all_questions.json  (${out.length} ready to import — figures hotlinked from HuggingFace)`);
}

main().catch(e => { console.error('\n', e); process.exit(1); });
