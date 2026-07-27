#!/usr/bin/env python3
"""
PrepMind — Mathematics Question Bank Extraction Script (Gemini vision)
=========================================================================
The 33 "CRASH COURSE MATHEMATICS" chapter PDFs use the same numbered
"N. ... (a)...(b)...(c)...(d)..." layout as the Physics assignments, but
PyMuPDF's text layer is badly garbled for any question involving a fraction,
exponent, or root (stacked glyphs extract in the wrong order) — the same
failure mode extract_pyq.py explicitly excluded some PYQ papers for. Regex
parsing is not viable here.

Instead, each chapter's page images are sent to Gemini vision in ONE call
(all pages together, so it can naturally handle a question that wraps across
a page break) with instructions to transcribe every question's stem and
options faithfully, using $...$ KaTeX for any math — and explicitly NOT to
determine the correct answer, since that already comes from the separate,
cleanly-parseable Answers_Mathematics.pdf (same header + "N. (letter)"
format as Physics, reusing that parser as-is).

Diagram handling stays deterministic, not AI-based: PyMuPDF's vector-drawing
clustering (verbatim from extract_physics.py) still works fine for locating
diagrams by position even though the text layer is garbled (question-number
markers themselves are plain ASCII, unaffected). Any question whose span
overlaps a real diagram cluster is routed to review rather than guessed at,
same as Gemini flagging a stem/option it judged to be "primarily a figure".

Run:  python extract_math.py
"""

import io
import os
import re
import json
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Run:  pip install PyMuPDF")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from google import genai
from google.genai import types

# ── Config ────────────────────────────────────────────────────────────────────

PDF_ROOT       = Path("pdfs/Mathematics/Mathematics")
ANSWER_KEY_PDF = PDF_ROOT / "Answers_Mathematics.pdf"
OUTPUT_FILE    = Path("output/math_questions.json")
REVIEW_FILE    = Path("output/math_needs_review.json")
PROGRESS_FILE  = Path("output/math_progress.json")
REVIEW_ASSETS_DIR = Path("output/review_assets_math")

SUBJECT = "Mathematics"
STREAM  = "JEE"
SOURCE  = "Mathematics Question Bank v2 (Gemini vision)"
CHAPTER_SUFFIX = " (New)"

MODEL = "gemini-2.5-flash"
PAGE_DPI = 200

LETTERS = ['A', 'B', 'C', 'D']

MIN_DIAGRAM_DIM     = 30
RECUR_PAGE_FRACTION = 0.3
CLUSTER_PAD         = 15

QNUM_RE = re.compile(r'^\s*(\d{1,3})[.)]\s+(?=\S)')


def normalize_key(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', s.lower())


def clean_chapter_title(raw_title: str) -> str:
    return re.sub(r'\s*-\s*(\d+)$', r' - \1', raw_title).strip()


# ── Answer key parsing (identical format/logic to extract_physics.py) ────────

def parse_answer_key(path: Path) -> dict:
    doc = fitz.open(str(path))
    text = "\n".join(p.get_text() for p in doc)
    doc.close()

    header_re = re.compile(r'(?m)^(\d+_[^\n(]{2,60})$')
    headers = list(header_re.finditer(text))
    result = {}
    for i, m in enumerate(headers):
        start = m.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        block = text[start:end]
        answers = {}
        for am in re.finditer(r'(\d{1,3})\.\s*\(([^)]+)\)', block):
            qnum = int(am.group(1))
            letters = [x.strip().upper() for x in am.group(2).split(',') if x.strip()]
            letters = [l for l in letters if l in LETTERS]
            if letters:
                answers[qnum] = letters
        result[normalize_key(m.group(1))] = {"title": m.group(1).split('_', 1)[1].strip(), "answers": answers}
    return result


# ── Vector-drawing diagram cluster detection (verbatim from extract_physics.py) ─

def rects_overlap_or_close(a, b, pad):
    return not (a[2] + pad < b[0] or b[2] + pad < a[0] or a[3] + pad < b[1] or b[3] + pad < a[1])


def cluster_rects(rects: list, pad: int = CLUSTER_PAD) -> list:
    rects = [list(r) for r in rects]
    changed = True
    while changed:
        changed = False
        for i in range(len(rects)):
            if rects[i] is None:
                continue
            for j in range(i + 1, len(rects)):
                if rects[j] is None:
                    continue
                if rects_overlap_or_close(rects[i], rects[j], pad):
                    rects[i][0] = min(rects[i][0], rects[j][0])
                    rects[i][1] = min(rects[i][1], rects[j][1])
                    rects[i][2] = max(rects[i][2], rects[j][2])
                    rects[i][3] = max(rects[i][3], rects[j][3])
                    rects[j] = None
                    changed = True
    return [r for r in rects if r is not None]


def find_diagram_clusters(doc) -> list:
    npages = len(doc)
    per_page_rects = []
    rect_page_count = Counter()
    for page in doc:
        rs = set()
        for d in page.get_drawings():
            r = d['rect']
            key = (round(r.x0), round(r.y0), round(r.x1), round(r.y1))
            rs.add(key)
        per_page_rects.append(rs)
        for k in rs:
            rect_page_count[k] += 1

    recur_threshold = max(2, int(npages * RECUR_PAGE_FRACTION))
    recurring = {k for k, c in rect_page_count.items() if c > recur_threshold}

    clusters = []
    for page_num, rs in enumerate(per_page_rects):
        filtered = [k for k in rs if k not in recurring
                    and (k[2] - k[0]) >= MIN_DIAGRAM_DIM and (k[3] - k[1]) >= MIN_DIAGRAM_DIM]
        for c in cluster_rects(filtered):
            clusters.append((page_num, tuple(c)))
    return clusters


# ── Question-span detection (position only — text quality doesn't matter) ────

def find_question_spans(doc) -> dict:
    """Returns {qnum: (start_pos, end_pos)} where pos = (page_num, y0), purely
    from the "N." markers' positions — used only to test diagram-cluster
    overlap, independent of Gemini's transcription."""
    all_blocks = []
    for page_num, page in enumerate(doc):
        for b in page.get_text("blocks"):
            y0, text = b[1], b[4]
            if text.strip():
                all_blocks.append((page_num, y0, text))
    all_blocks.sort(key=lambda t: (t[0], t[1]))

    starts = []  # (qnum, page, y0)
    for page_num, y0, text in all_blocks:
        m = QNUM_RE.match(text)
        if m:
            starts.append((int(m.group(1)), page_num, y0))

    spans = {}
    for i, (qnum, page_num, y0) in enumerate(starts):
        end = (starts[i + 1][1], starts[i + 1][2]) if i + 1 < len(starts) else (10**9, 0)
        spans[qnum] = ((page_num, y0), end)
    return spans


# ── Gemini vision transcription ───────────────────────────────────────────────

RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "qnum": {"type": "integer"},
            "question": {"type": "string"},
            "options": {
                "type": "object",
                "properties": {
                    "A": {"type": "string"}, "B": {"type": "string"},
                    "C": {"type": "string"}, "D": {"type": "string"},
                },
                "required": ["A", "B", "C", "D"],
            },
            "hasDiagram": {"type": "boolean"},
        },
        "required": ["qnum", "question", "options", "hasDiagram"],
    },
}

PROMPT = """Transcribe every multiple-choice question visible across these pages, in order.

For each question return:
- qnum: the printed question number (integer)
- question: the full question stem text. Do not include the leading "N." numbering in this field.
- options: an object with keys A, B, C, D — the exact text of each option. If an option is "None of these" or similar, transcribe it as plain text.
- hasDiagram: true if the question stem OR any option is primarily a figure/graph/diagram rather than text (e.g. "identify the curve", a labelled geometric figure) — in that case still fill in whatever text is present, but set this to true so it can be handled separately.

Formatting rules — follow these exactly so the output is consistent:
- Wrap the ENTIRE mathematical portion of a sentence in a SINGLE pair of $...$ (do not split one expression into multiple separate $...$ spans, and do not wrap plain English words in $...$).
- No space immediately after the opening $ or immediately before the closing $.
- Use standard LaTeX commands (\\frac, \\sqrt, \\sin, \\pi, etc.) but do NOT use \\mathbb{} — write set names as plain letters (Z, R, C, N, Q).
- Do NOT use \\left or \\right.
- Write "arg" as plain text "arg", not \\arg.
- Preserve the exact sign (+ or -) and exact numbers/exponents/subscripts precisely as shown — this matters most for fractions and nested expressions, read them carefully.

Do NOT attempt to determine or state which option is correct — that is not needed.
Every question on the page(s) must be included, even if partially illegible (do your best, and set hasDiagram true if you are unsure due to a figure).
Return ONLY the JSON array, no other text."""


def transcribe_chapter(doc, client: genai.Client) -> list:
    parts = []
    for page in doc:
        pix = page.get_pixmap(dpi=PAGE_DPI)
        parts.append(types.Part.from_bytes(data=pix.tobytes("png"), mime_type="image/png"))
    parts.append(PROMPT)

    last_err = None
    for attempt in range(3):
        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=parts,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=RESPONSE_SCHEMA,
                ),
            )
            return json.loads(resp.text)
        except Exception as e:
            last_err = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Gemini transcription failed after retries: {last_err}")


_NORM_STRIP_RE = re.compile(
    r'\\left|\\right|\\mathbb|\\text|\\,|\\;|\\!|\\cdot|\\times|[${}\s.,]'
)
_NORM_ARG_RE = re.compile(r'\\arg\b')


def normalize_transcript(s: str) -> str:
    """Loose equality for comparing two independent transcriptions of the same
    question — strips cosmetic LaTeX noise (delimiters, braces, \\left/\\right,
    \\mathbb wrapper, whitespace) and known synonym commands so only real
    content differences (wrong sign, wrong number, sqrt vs frac, ...) trigger
    a mismatch rather than two equally-valid renderings of the same thing."""
    s = _NORM_ARG_RE.sub('arg', s or '')
    return _NORM_STRIP_RE.sub('', s.lower())


def questions_match(a: dict, b: dict) -> bool:
    if normalize_transcript(a.get("question", "")) != normalize_transcript(b.get("question", "")):
        return False
    oa, ob = a.get("options", {}) or {}, b.get("options", {}) or {}
    return all(normalize_transcript(oa.get(L, "")) == normalize_transcript(ob.get(L, "")) for L in LETTERS)


# ── Per-chapter extraction ─────────────────────────────────────────────────────

def extract_chapter(path: Path, answer_key: dict, client: genai.Client) -> tuple[list, list]:
    print(f"\n  {path.name}")
    doc = fitz.open(str(path))

    chapter_key = normalize_key(path.stem)
    key_entry = answer_key.get(chapter_key)
    if not key_entry:
        print(f"      NO MATCHING ANSWER KEY SECTION for '{path.stem}' — skipping whole file")
        doc.close()
        return [], [{"file": path.name, "reason": "no answer-key section matched", "qnum": None}]

    chapter_title = clean_chapter_title(key_entry["title"])
    answers = key_entry["answers"]

    clusters = find_diagram_clusters(doc)
    spans = find_question_spans(doc)

    # Two independent transcription passes — a nested-fraction/exponent
    # expression occasionally gets misread with high apparent confidence (seen
    # empirically: the same page transcribed twice produced two different,
    # plausible-looking but not-both-correct LaTeX expressions for one
    # question). Only accept a question where both passes agree; anything
    # they disagree on goes to review instead of trusting either blindly.
    try:
        pass1 = transcribe_chapter(doc, client)
        pass2 = transcribe_chapter(doc, client)
    except Exception as e:
        print(f"      Gemini transcription failed: {e}")
        doc.close()
        return [], [{"file": path.name, "reason": f"Gemini transcription failed: {e}", "qnum": None}]

    by_num1 = {tq["qnum"]: tq for tq in pass1 if tq.get("qnum") is not None}
    by_num2 = {tq["qnum"]: tq for tq in pass2 if tq.get("qnum") is not None}

    questions = []
    review = []
    all_qnums = sorted(set(by_num1) | set(by_num2))

    for qnum in all_qnums:
        tq1, tq2 = by_num1.get(qnum), by_num2.get(qnum)

        if tq1 is None or tq2 is None:
            review.append({
                "file": path.name, "chapter": chapter_title, "qnum": qnum,
                "question": (tq1 or tq2 or {}).get("question", ""),
                "options": (tq1 or tq2 or {}).get("options", {}),
                "answerLetters": answers.get(qnum),
                "reason": "only appeared in one of two transcription passes",
            })
            continue

        if not questions_match(tq1, tq2):
            review.append({
                "file": path.name, "chapter": chapter_title, "qnum": qnum,
                "question": tq1.get("question", ""),
                "questionPass2": tq2.get("question", ""),
                "options": tq1.get("options", {}),
                "optionsPass2": tq2.get("options", {}),
                "answerLetters": answers.get(qnum),
                "reason": "the two transcription passes disagree — likely a misread fraction/exponent",
            })
            continue

        tq = tq1
        stem = (tq.get("question") or "").strip()
        opts = tq.get("options") or {}
        letters = answers.get(qnum)
        gemini_flagged_diagram = bool(tq1.get("hasDiagram")) or bool(tq2.get("hasDiagram"))

        span = spans.get(qnum)
        overlapping = []
        if span:
            start, end = span
            overlapping = [c for c in clusters if start <= (c[0], c[1][1]) < end]

        reasons = []
        if not stem or len(stem) < 4:
            reasons.append("empty/too-short transcribed stem")
        missing_opts = [L for L in LETTERS if not (opts.get(L) or "").strip()]
        if missing_opts:
            reasons.append(f"missing option text: {','.join(missing_opts)}")
        if not letters:
            reasons.append("no answer-key entry for this question number")
        if gemini_flagged_diagram:
            reasons.append("Gemini flagged this as containing a diagram/figure")
        if overlapping:
            reasons.append(f"{len(overlapping)} candidate diagram region(s) in this question's span")

        if reasons:
            rid = f"math_{re.sub(r'[^A-Za-z0-9]', '', path.stem)}_q{qnum}"
            if span:
                review_dir = REVIEW_ASSETS_DIR / re.sub(r'[^\w]', '_', path.stem)
                review_dir.mkdir(parents=True, exist_ok=True)
                pages_to_render = sorted({span[0][0]} | {c[0] for c in overlapping})
                for pn in pages_to_render:
                    doc[pn].get_pixmap(dpi=150).save(str(review_dir / f"{rid}_page{pn}.png"))
            review.append({
                "file": path.name,
                "chapter": chapter_title,
                "qnum": qnum,
                "question": stem,
                "options": opts,
                "answerLetters": letters,
                "reason": "; ".join(reasons),
            })
            continue

        question_type = "multiple" if len(letters) > 1 else "single"
        questions.append({
            "question": stem,
            "options": {L: opts.get(L, "") for L in LETTERS},
            "answer": ",".join(letters),
            "questionType": question_type,
            "subject": SUBJECT,
            "chapter": chapter_title,
        })

    doc.close()
    print(f"      {len(questions)} clean, {len(review)} flagged for review (of {len(all_qnums)} question numbers seen)")
    return questions, review


# ── Metadata tagging ──────────────────────────────────────────────────────────

def tag_questions(questions: list) -> list:
    now = datetime.now(timezone.utc).isoformat()
    for q in questions:
        q["chapter"] = q["chapter"] + CHAPTER_SUFFIX
        q["topic"] = q["chapter"]
        q["stream"] = STREAM
        q["source"] = SOURCE
        q["isPYQ"] = False
        q["difficulty"] = "Medium"
        q["createdAt"] = now
    return questions


# ── Main ──────────────────────────────────────────────────────────────────────

def load_json(path: Path, default):
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def main():
    print("\nPrepMind Mathematics Question Bank Extractor (Gemini vision)\n")

    OUTPUT_FILE.parent.mkdir(exist_ok=True)

    if not PDF_ROOT.exists():
        print(f"{PDF_ROOT}/ not found.")
        sys.exit(1)
    if not ANSWER_KEY_PDF.exists():
        print(f"{ANSWER_KEY_PDF} not found.")
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set (checked environment and .env)")
        sys.exit(1)
    client = genai.Client(api_key=api_key)

    print("  Parsing answer key ...")
    answer_key = parse_answer_key(ANSWER_KEY_PDF)
    print(f"  {len(answer_key)} chapter sections found in answer key")

    files = sorted(p for p in PDF_ROOT.glob("*.pdf") if "answers" not in p.stem.lower())

    # CLI: a specific filename still does exactly that one chapter (ignores
    # progress tracking — used for one-off testing/re-runs). Otherwise
    # "--max N" processes up to N not-yet-done chapters this run — the free
    # Gemini tier caps at 20 requests/day and each chapter costs 2 (double
    # pass), so this lets the job be safely spread across several days
    # without re-spending quota on chapters already done.
    chapter_arg = sys.argv[1] if len(sys.argv) > 1 else None
    max_chapters = None
    if chapter_arg == "--max":
        max_chapters = int(sys.argv[2])
    elif chapter_arg:
        files = [f for f in files if f.name == chapter_arg]
        if not files:
            print(f"No file named {chapter_arg} in {PDF_ROOT}")
            sys.exit(1)

    all_questions = load_json(OUTPUT_FILE, [])
    all_review = load_json(REVIEW_FILE, [])
    done = set(load_json(PROGRESS_FILE, []))

    if chapter_arg != "--max" and chapter_arg is not None:
        pass  # explicit single-file run — process regardless of `done`
    else:
        remaining = [f for f in files if f.name not in done]
        skipped = len(files) - len(remaining)
        if skipped:
            print(f"  Skipping {skipped} chapter(s) already completed in a previous run")
        files = remaining
        if max_chapters is not None:
            files = files[:max_chapters]

    if not files:
        print("  Nothing left to do — all chapters already completed.")
        return

    print(f"  Processing {len(files)} chapter(s) this run ({len(files) * 2} Gemini calls)\n")

    for f in files:
        qs, rev = extract_chapter(f, answer_key, client)
        failed = len(rev) == 1 and rev[0].get("qnum") is None and "Gemini transcription failed" in rev[0].get("reason", "")
        if failed:
            print(f"      (not marked complete — will retry {f.name} next run)")
        else:
            done.add(f.name)

        qs = tag_questions(qs)
        all_questions.extend(qs)
        all_review.extend(rev)

        with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
            json.dump(all_questions, out, indent=2, ensure_ascii=False)
        with open(REVIEW_FILE, "w", encoding="utf-8") as out:
            json.dump(all_review, out, indent=2, ensure_ascii=False)
        with open(PROGRESS_FILE, "w", encoding="utf-8") as out:
            json.dump(sorted(done), out, indent=2)

    print(f"\n{'-' * 50}")
    print("Done with this run!")
    print(f"    Chapters completed so far : {len(done)}/{len([p for p in PDF_ROOT.glob('*.pdf') if 'answers' not in p.stem.lower()])}")
    print(f"    Clean questions so far    : {len(all_questions)}")
    print(f"    Needs review so far       : {len(all_review)}")
    multi = sum(1 for q in all_questions if q["questionType"] == "multiple")
    print(f"    (of which multi-answer: {multi})")
    print(f"\n    Output -> {OUTPUT_FILE}")
    print(f"    Review -> {REVIEW_FILE}")


if __name__ == "__main__":
    main()
