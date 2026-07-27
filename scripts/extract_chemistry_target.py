#!/usr/bin/env python3
"""
PrepMind — Chemistry (TARGET IIT) Question Bank Extraction Script (Gemini vision)
====================================================================================
The 6 "TARGET IIT JEE 2014" chemistry PDFs (Alcohols, Alkyl Halide, Aromatic
Hydrocarbon, Carbonyl Compounds, Carboxylic Acid & Amines, Halogen Derivative)
share the same garbled-formula problem as Mathematics, but are structurally
different: each file bundles 2-4 separate exercises (single-correct,
multi-correct "more than one may be correct", and Assertion-Reason sections),
each restarting question numbering from 1 with its OWN inline answer key
right after its questions — not one flat numbering + one answer file like
Physics/Math.

Two numbering styles are used inconsistently across files: bare "N." (e.g.
Alcohols.pdf) and "Q.N" (e.g. Carbonyl Compounds.pdf). A trailing block of
Matching-List-type questions (answers like "(A) P,R (B) P ...") appears in
some files' final exercise — these don't fit the app's 4-option MCQ schema
and are naturally excluded (their answer format doesn't match the simple
letter-list pattern, so no exercise segment gets built for them).

Exercises are located by finding the answer-key blocks first (the reliable,
structurally-consistent part), then treating each exercise's question span as
the text between the previous exercise's answer block and this one's. Each
exercise is sent to Gemini as ONE call (its own page image(s) only), same
double-pass consistency check as Math. Assertion-Reason questions aren't
special-cased in code — the prompt asks Gemini to use the shared rubric text
verbatim as options A-D and combine "Assertion: ... Reason: ..." as the stem,
since it can see that structure directly in the page image.

Run:  python extract_chemistry_target.py
"""

import io
import os
import re
import sys
import json
import time
import bisect
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

PDF_ROOT       = Path("pdfs/Chemistry/chemistry")
OUTPUT_FILE    = Path("output/chemistry_target_questions.json")
REVIEW_FILE    = Path("output/chemistry_target_needs_review.json")
PROGRESS_FILE  = Path("output/chemistry_target_progress.json")
REVIEW_ASSETS_DIR = Path("output/review_assets_chemistry_target")

FILES = [
    "Alcohols.pdf",
    "Alkyl Halide.pdf",
    "Aromatic Hydrocarbon _ EAS.pdf",
    "Carbonyl Compounds.pdf",
    "Carboxylic Acid _ Amines.pdf",
    "Halogen Derivative.pdf",
]

SUBJECT = "Chemistry"
STREAM  = "BOTH"
SOURCE  = "Chemistry Question Bank v2 (Gemini vision)"
CHAPTER_SUFFIX = " (New)"

MODEL = "gemini-2.5-flash"
PAGE_DPI = 200
MIN_EXERCISE_SIZE = 3   # answer-blocks smaller than this are noise, not real exercises
MAX_EXERCISE_PAGES = 10  # a page range wider than this means segmentation likely absorbed
                          # an unrecognized-format section (e.g. Assertion-Reason with a
                          # different key shape, or Matching-type) in between two real
                          # exercises — safer to skip than send a huge mixed-content batch

LETTERS = ['A', 'B', 'C', 'D']

MIN_DIAGRAM_DIM     = 30
RECUR_PAGE_FRACTION = 0.3
CLUSTER_PAD         = 15

ANSWER_ENTRY_RE = re.compile(r'(?:(\d{1,3})\.|Q\.(\d{1,3}))\s*\n\s*([A-Da-d](?:\s*,\s*[A-Da-d])*)\s*\n')


def clean_chapter_title(stem: str) -> str:
    return stem.replace('_', '&').strip()


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


# ── Document text + page-offset mapping ───────────────────────────────────────

def build_text_and_page_offsets(doc):
    """Returns (full_text, page_starts) where page_starts[i] = char offset in
    full_text where page i's text begins — lets any char offset be mapped
    back to a page number via bisect."""
    parts = []
    page_starts = []
    cursor = 0
    for page in doc:
        page_starts.append(cursor)
        t = page.get_text()
        parts.append(t)
        cursor += len(t) + 1  # +1 for the '\n' joiner
    return "\n".join(parts), page_starts


def offset_to_page(offset: int, page_starts: list) -> int:
    return max(0, bisect.bisect_right(page_starts, offset) - 1)


# ── Exercise segmentation ─────────────────────────────────────────────────────

def find_exercises(text: str, page_starts: list, doc_len_pages: int) -> list:
    """Returns [{"answers": {qnum: [letters]}, "page_range": (start, end)}, ...]
    by finding answer-key blocks, then treating each exercise's question span
    as the text between the previous answer block's end and this block's
    "Answers"-style header start."""
    matches = list(ANSWER_ENTRY_RE.finditer(text))

    raw_blocks = []
    cur = []
    prev_num = None
    for m in matches:
        num = int(m.group(1) or m.group(2))
        if prev_num is not None and num != prev_num + 1:
            raw_blocks.append(cur)
            cur = []
        cur.append((num, m.group(3), m.start()))
        prev_num = num
    if cur:
        raw_blocks.append(cur)
    raw_blocks = [b for b in raw_blocks if len(b) >= MIN_EXERCISE_SIZE]

    exercises = []
    prev_end_offset = 0
    for block in raw_blocks:
        block_start_offset = block[0][2]
        # Look a little further back for the "Answers"/"ANSWER KEY" header
        # itself, so the question span doesn't swallow it.
        window = text[max(0, block_start_offset - 200):block_start_offset]
        header_m = re.search(r'(?i)answer\s*key|answers', window)
        question_span_end = (max(0, block_start_offset - 200) + header_m.start()) if header_m else block_start_offset

        answers = {}
        for num, letters_raw, _ in block:
            letters = [l.strip().upper() for l in letters_raw.split(',') if l.strip()]
            letters = [l for l in letters if l in LETTERS]
            if letters:
                answers[num] = letters

        block_end_offset = block[-1][2] + len(block[-1][1]) + 5  # a bit past the last answer entry

        start_page = offset_to_page(prev_end_offset, page_starts)
        end_page = offset_to_page(question_span_end, page_starts)
        exercises.append({
            "answers": answers,
            "page_range": (start_page, min(end_page, doc_len_pages - 1)),
        })
        prev_end_offset = block_end_offset

    valid = []
    for e in exercises:
        start, end = e["page_range"]
        if end < start or not e["answers"]:
            continue
        if end - start + 1 > MAX_EXERCISE_PAGES:
            print(f"      skipping an exercise spanning {end - start + 1} pages ({start}-{end}) — "
                  f"likely absorbed an unrecognized-format section, not sending to Gemini")
            continue
        valid.append(e)
    return valid


# ── Gemini vision transcription (same schema/prompt style as Math) ───────────

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

PROMPT = """Transcribe every multiple-choice chemistry question visible across these pages, in order (ignore any "Answers"/"Answer Key" list if it's on these pages — only transcribe the actual numbered questions).

For each question return:
- qnum: the printed question number (integer) — if numbered "Q.5", use 5.
- question: the full question stem text. Do not include the leading "N." or "Q.N" numbering in this field.
- options: an object with keys A, B, C, D — the exact text of each option.
- hasDiagram: true if the question stem OR any option is primarily a chemical structure diagram/reaction scheme rather than text.

Special case — Assertion-Reason questions: if a question is formatted as "Assertion: ..." + "Reason: ..." with a shared rubric of 4 standard interpretive options (e.g. "both true and Reason explains Assertion", "both true but Reason doesn't explain", "Assertion true Reason false", "both false") stated once for the whole section, then: set "question" to "Assertion: <assertion text> Reason: <reason text>", and set options A-D to that shared rubric's exact text (repeat it for every Assertion-Reason question in the section, since it's the same 4 options every time).

Formatting rules:
- Wrap the ENTIRE mathematical/chemical notation portion of a sentence in a SINGLE pair of $...$ using LaTeX (e.g. $CH_3-CH_2-OH$, $SN^2$). No space right after the opening $ or right before the closing $.
- Do NOT use \\mathbb, \\left, \\right.
- If the document is bilingual (English + Hindi/Devanagari), transcribe ONLY the English portion and ignore the Devanagari translation entirely.
- Preserve exact structure/subscripts/formula details precisely — this is the part most likely to be misread, read carefully.

Do NOT attempt to determine or state which option is correct — that is not needed.
Every question on the page(s) must be included. Return ONLY the JSON array, no other text."""


def transcribe_pages(doc, page_range: tuple, client: genai.Client) -> list:
    start, end = page_range
    parts = []
    for pn in range(start, end + 1):
        pix = doc[pn].get_pixmap(dpi=PAGE_DPI)
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
    s = _NORM_ARG_RE.sub('arg', s or '')
    return _NORM_STRIP_RE.sub('', s.lower())


def questions_match(a: dict, b: dict) -> bool:
    if normalize_transcript(a.get("question", "")) != normalize_transcript(b.get("question", "")):
        return False
    oa, ob = a.get("options", {}) or {}, b.get("options", {}) or {}
    return all(normalize_transcript(oa.get(L, "")) == normalize_transcript(ob.get(L, "")) for L in LETTERS)


# ── Per-exercise / per-file extraction ────────────────────────────────────────

def extract_exercise(doc, exercise: dict, ex_idx: int, chapter_title: str,
                      file_stem: str, clusters: list, client: genai.Client) -> tuple[list, list]:
    answers = exercise["answers"]
    page_range = exercise["page_range"]

    try:
        pass1 = transcribe_pages(doc, page_range, client)
        pass2 = transcribe_pages(doc, page_range, client)
    except Exception as e:
        return [], [{"file": file_stem, "exercise": ex_idx, "qnum": None,
                      "reason": f"Gemini transcription failed: {e}"}]

    by_num1 = {tq["qnum"]: tq for tq in pass1 if tq.get("qnum") is not None}
    by_num2 = {tq["qnum"]: tq for tq in pass2 if tq.get("qnum") is not None}

    questions = []
    review = []
    all_qnums = sorted(set(by_num1) | set(by_num2) | set(answers))

    for qnum in all_qnums:
        tq1, tq2 = by_num1.get(qnum), by_num2.get(qnum)
        letters = answers.get(qnum)

        if tq1 is None or tq2 is None:
            review.append({
                "file": file_stem, "chapter": chapter_title, "exercise": ex_idx, "qnum": qnum,
                "question": (tq1 or tq2 or {}).get("question", ""),
                "options": (tq1 or tq2 or {}).get("options", {}),
                "answerLetters": letters,
                "reason": "only appeared in one of two transcription passes (or no answer-key entry)",
            })
            continue
        if not questions_match(tq1, tq2):
            review.append({
                "file": file_stem, "chapter": chapter_title, "exercise": ex_idx, "qnum": qnum,
                "question": tq1.get("question", ""), "questionPass2": tq2.get("question", ""),
                "options": tq1.get("options", {}), "optionsPass2": tq2.get("options", {}),
                "answerLetters": letters,
                "reason": "the two transcription passes disagree",
            })
            continue

        tq = tq1
        stem = (tq.get("question") or "").strip()
        opts = tq.get("options") or {}
        gemini_flagged_diagram = bool(tq1.get("hasDiagram")) or bool(tq2.get("hasDiagram"))

        overlapping = [c for c in clusters if page_range[0] <= c[0] <= page_range[1]] if gemini_flagged_diagram else []

        reasons = []
        if not stem or len(stem) < 4:
            reasons.append("empty/too-short transcribed stem")
        missing_opts = [L for L in LETTERS if not (opts.get(L) or "").strip()]
        if missing_opts:
            reasons.append(f"missing option text: {','.join(missing_opts)}")
        if not letters:
            reasons.append("no answer-key entry for this question number")
        if gemini_flagged_diagram:
            reasons.append("Gemini flagged this as containing a diagram/structure")

        if reasons:
            review.append({
                "file": file_stem, "chapter": chapter_title, "exercise": ex_idx, "qnum": qnum,
                "question": stem, "options": opts, "answerLetters": letters,
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

    return questions, review


def extract_file(path: Path, client: genai.Client) -> tuple[list, list]:
    print(f"\n  {path.name}")
    doc = fitz.open(str(path))
    chapter_title = clean_chapter_title(path.stem)

    text, page_starts = build_text_and_page_offsets(doc)
    exercises = find_exercises(text, page_starts, len(doc))
    clusters = find_diagram_clusters(doc)

    print(f"      {len(exercises)} exercise(s) found: "
          f"{[len(e['answers']) for e in exercises]} question(s) each, "
          f"pages {[e['page_range'] for e in exercises]}")

    all_questions = []
    all_review = []
    for i, ex in enumerate(exercises):
        qs, rev = extract_exercise(doc, ex, i, chapter_title, path.name, clusters, client)
        all_questions.extend(qs)
        all_review.extend(rev)
        print(f"      exercise {i}: {len(qs)} clean, {len(rev)} flagged")

    doc.close()
    return all_questions, all_review


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
    print("\nPrepMind Chemistry (TARGET IIT) Question Bank Extractor (Gemini vision)\n")

    OUTPUT_FILE.parent.mkdir(exist_ok=True)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set (checked environment and .env)")
        sys.exit(1)
    client = genai.Client(api_key=api_key)

    files = [PDF_ROOT / f for f in FILES]

    chapter_arg = sys.argv[1] if len(sys.argv) > 1 else None
    max_files = None
    if chapter_arg == "--max":
        max_files = int(sys.argv[2])
    elif chapter_arg:
        files = [f for f in files if f.name == chapter_arg]
        if not files:
            print(f"No file named {chapter_arg} in {PDF_ROOT}")
            sys.exit(1)

    all_questions = load_json(OUTPUT_FILE, [])
    all_review = load_json(REVIEW_FILE, [])
    done = set(load_json(PROGRESS_FILE, []))

    if chapter_arg not in (None, "--max"):
        pass  # explicit single-file run — ignore progress tracking
    else:
        remaining = [f for f in files if f.name not in done]
        skipped = len(files) - len(remaining)
        if skipped:
            print(f"  Skipping {skipped} file(s) already completed in a previous run")
        files = remaining
        if max_files is not None:
            files = files[:max_files]

    if not files:
        print("  Nothing left to do — all files already completed.")
        return

    print(f"  Processing {len(files)} file(s) this run\n")

    for f in files:
        qs, rev = extract_file(f, client)
        failed_entirely = len(qs) == 0 and any(r.get("qnum") is None for r in rev)
        if failed_entirely:
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
    print(f"    Files completed so far : {len(done)}/{len(FILES)}")
    print(f"    Clean questions so far : {len(all_questions)}")
    print(f"    Needs review so far    : {len(all_review)}")
    multi = sum(1 for q in all_questions if q["questionType"] == "multiple")
    print(f"    (of which multi-answer: {multi})")
    print(f"\n    Output -> {OUTPUT_FILE}")
    print(f"    Review -> {REVIEW_FILE}")


if __name__ == "__main__":
    main()
