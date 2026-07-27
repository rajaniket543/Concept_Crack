#!/usr/bin/env python3
"""
PrepMind — Physics Question Bank Extraction Script (ALLEN-format assignments)
==============================================================================
Extracts the 39 "CRASH COURSE PHYSICS" chapter-assignment PDFs (numbered
"N. ... (a)...(b)...(c)...(d)..." format, no inline answers) and cross-
references them against the separate Answers_Physics.pdf answer key
("<chapter-header>\n N. (letter[,letter...])" per chapter section).

Unlike the JEE PYQ papers, these PDFs have NO embedded raster images — any
diagrams (circuits, ray diagrams, graphs) are drawn with PDF vector graphics.
A handful of chapters contain real vector-drawn diagrams; rather than guess at
automatically cropping/attributing them, any question whose vertical region
overlaps a real (non-decorative, non-tiny) vector-drawing cluster is routed to
the review file with a full-page render and a cropped candidate image, for
manual follow-up — same "never guess" policy as extract_pyq.py.

Run:  python extract_physics.py
"""

import re
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Run:  pip install PyMuPDF")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

PDF_ROOT        = Path("pdfs/Physics/Physics")
ANSWER_KEY_PDF  = PDF_ROOT / "Answers_Physics.pdf"
OUTPUT_FILE     = Path("output/physics_questions.json")
REVIEW_FILE     = Path("output/physics_needs_review.json")
REVIEW_ASSETS_DIR = Path("output/review_assets_physics")

SUBJECT   = "Physics"
STREAM    = "JEE"
SOURCE    = "Physics Question Bank v2"
CHAPTER_SUFFIX = " (New)"   # staging suffix so new chapters coexist with the old flat ones

QNUM_RE   = re.compile(r'^\s*(\d{1,3})[.)]\s+(?=\S)')
LETTER_PATTERNS = [
    (r'\(a\)', r'\(b\)', r'\(c\)', r'\(d\)'),
    (r'\(A\)', r'\(B\)', r'\(C\)', r'\(D\)'),
]
LETTERS = ['A', 'B', 'C', 'D']

# Diagram-cluster detection thresholds
MIN_DIAGRAM_DIM     = 30    # pt — filters degenerate/tiny vector strokes (glyphs, rules)
RECUR_PAGE_FRACTION = 0.3   # a rect present on >30% of a doc's pages is a repeating border/watermark
CLUSTER_PAD         = 15    # pt — merge distance for grouping nearby paths into one diagram


def normalize_key(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', s.lower())


# ── Answer key parsing ─────────────────────────────────────────────────────────

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


def clean_chapter_title(raw_title: str) -> str:
    return re.sub(r'\s*-\s*(\d+)$', r' - \1', raw_title).strip()


# ── Vector-drawing diagram cluster detection ──────────────────────────────────

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
    """Returns [(page_num, (x0,y0,x1,y1)), ...] for real (non-decorative) diagram
    regions across the whole document."""
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


# ── Per-chapter extraction ─────────────────────────────────────────────────────

def parse_options(block_text: str) -> dict | None:
    for a_pat, b_pat, c_pat, d_pat in LETTER_PATTERNS:
        pats = [a_pat, b_pat, c_pat, d_pat]
        opts = {}
        for i, (label, pat) in enumerate(zip(LETTERS, pats)):
            stop = pats[i + 1] if i + 1 < len(pats) else r'$'
            m = re.search(rf'{pat}[ \t]*(.*?)(?={stop})', block_text, re.DOTALL)
            if not m:
                break
            val = re.split(r'\n', m.group(1).strip())[0].strip()
            if val:
                opts[label] = val
        if len(opts) == 4:
            return opts
    return None


def build_question_blocks(doc) -> list:
    """Walk every page's text blocks in order, grouping continuation blocks into
    the currently-open question (a question can wrap across a page break). Also
    tracks each question's (page, y0) start position for diagram attribution.
    Returns [(qnum, full_text, start_pos, end_pos_exclusive)] where positions are
    (page_num, y0) sort keys."""
    all_blocks = []  # (page_num, y0, text)
    for page_num, page in enumerate(doc):
        for b in page.get_text("blocks"):
            y0, text = b[1], b[4]
            if text.strip():
                all_blocks.append((page_num, y0, text))
    all_blocks.sort(key=lambda t: (t[0], t[1]))

    questions = []
    current = None  # {"qnum":, "text": [...], "start":}
    for page_num, y0, text in all_blocks:
        m = QNUM_RE.match(text)
        if m:
            if current is not None:
                questions.append(current)
            current = {"qnum": int(m.group(1)), "text": [text], "start": (page_num, y0)}
        elif current is not None:
            current["text"].append(text)
        # else: preamble before Q1 (title/instructions) — discarded
    if current is not None:
        questions.append(current)

    result = []
    for i, q in enumerate(questions):
        end = questions[i + 1]["start"] if i + 1 < len(questions) else (10**9, 0)
        result.append((q["qnum"], "".join(q["text"]), q["start"], end))
    return result


def extract_chapter(path: Path, answer_key: dict) -> tuple[list, list]:
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
    q_blocks = build_question_blocks(doc)

    questions = []
    review = []

    for qnum, raw_text, start, end in q_blocks:
        text = re.sub(r'^\s*\d{1,3}[.)]\s+', '', raw_text)
        # strip stray footer page-number artifacts sometimes glued onto the last block
        text = re.sub(r'\n\s*\d{1,2}\s*$', '', text).strip()

        overlapping = [c for c in clusters if start <= (c[0], c[1][1]) < end]

        options = parse_options(text)
        first_opt_match = re.search(r'\(a\)|\(A\)', text)
        stem = text[:first_opt_match.start()].strip() if first_opt_match else text.split('\n')[0].strip()
        stem = re.sub(r'\s+', ' ', stem).strip()

        letters = answers.get(qnum)

        reasons = []
        if not options:
            reasons.append("could not parse 4 options")
        if not letters:
            reasons.append("no answer-key entry for this question number")
        if overlapping:
            reasons.append(f"{len(overlapping)} candidate diagram region(s) in this question's span")
        if len(stem) < 8:
            reasons.append("stem too short / empty")

        if reasons:
            rid = f"physics_{re.sub(r'[^A-Za-z0-9]', '', path.stem)}_q{qnum}"
            review_dir = REVIEW_ASSETS_DIR / re.sub(r'[^\w]', '_', path.stem)
            pages_rendered = sorted({start[0]} | {c[0] for c in overlapping})
            page_paths = []
            for pn in pages_rendered:
                review_dir.mkdir(parents=True, exist_ok=True)
                fp = review_dir / f"{rid}_page{pn}.png"
                doc[pn].get_pixmap(dpi=150).save(str(fp))
                page_paths.append(str(fp))
            crop_paths = []
            for cpage, rect in overlapping:
                review_dir.mkdir(parents=True, exist_ok=True)
                fp = review_dir / f"{rid}_crop_p{cpage}_{'_'.join(str(int(v)) for v in rect)}.png"
                doc[cpage].get_pixmap(clip=fitz.Rect(*rect), dpi=300).save(str(fp))
                crop_paths.append(str(fp))
            review.append({
                "id": rid,
                "file": path.name,
                "chapter": chapter_title,
                "qnum": qnum,
                "stem": stem,
                "options": options,
                "answerLetters": letters,
                "reason": "; ".join(reasons),
                "pageRenderPaths": page_paths,
                "candidateCropPaths": crop_paths,
            })
            continue

        question_type = "multiple" if len(letters) > 1 else "single"
        questions.append({
            "question": stem,
            "options": options,
            "answer": ",".join(letters),
            "questionType": question_type,
            "subject": SUBJECT,
            "chapter": chapter_title,
        })

    doc.close()
    print(f"      {len(questions)} clean, {len(review)} flagged for review (of {len(q_blocks)} total)")
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

def main():
    print("\nPrepMind Physics Question Bank Extractor\n")

    OUTPUT_FILE.parent.mkdir(exist_ok=True)

    if not PDF_ROOT.exists():
        print(f"{PDF_ROOT}/ not found.")
        sys.exit(1)
    if not ANSWER_KEY_PDF.exists():
        print(f"{ANSWER_KEY_PDF} not found.")
        sys.exit(1)

    print("  Parsing answer key ...")
    answer_key = parse_answer_key(ANSWER_KEY_PDF)
    print(f"  {len(answer_key)} chapter sections found in answer key")

    files = sorted(p for p in PDF_ROOT.glob("*.pdf") if "answers" not in p.stem.lower())
    chapter_arg = sys.argv[1] if len(sys.argv) > 1 else None
    if chapter_arg:
        files = [f for f in files if f.name == chapter_arg]
        if not files:
            print(f"No file named {chapter_arg} in {PDF_ROOT}")
            sys.exit(1)

    all_questions = []
    all_review = []
    for f in files:
        qs, rev = extract_chapter(f, answer_key)
        qs = tag_questions(qs)
        all_questions.extend(qs)
        all_review.extend(rev)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(all_questions, out, indent=2, ensure_ascii=False)
    with open(REVIEW_FILE, "w", encoding="utf-8") as out:
        json.dump(all_review, out, indent=2, ensure_ascii=False)

    print(f"\n{'-' * 50}")
    print(f"Done!")
    print(f"    Chapters processed : {len(files)}")
    print(f"    Clean questions    : {len(all_questions)}")
    print(f"    Needs review       : {len(all_review)}")
    multi = sum(1 for q in all_questions if q["questionType"] == "multiple")
    print(f"    (of which multi-answer: {multi})")
    print(f"\n    Output -> {OUTPUT_FILE}")
    print(f"    Review -> {REVIEW_FILE}")


if __name__ == "__main__":
    main()
