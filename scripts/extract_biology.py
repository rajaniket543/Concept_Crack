#!/usr/bin/env python3
"""
PrepMind — Biology Question Bank Extraction Script (docx table format)
========================================================================
Extracts the 24 "BIOLOGY QUESTION BANK" chapter .docx files (XI + XII).
Each doc holds its content as a sequence of Word tables (a single logical
table is sometimes split into several physical <w:tbl> elements by Word
whenever a page/section break falls inside it — tables of the same shape
are concatenated back together rather than treated as separate content):

  - "question" tables: 5 columns. A row whose first cell is "N." starts a
    new question; its second cell holds the stem (repeated across the
    remaining cells — padding, not real content). Subsequent rows hold
    option pairs as (letter-label cell, value cell) x2, e.g.
    ['', 'a)', <value>, 'b)', <value>] then ['', 'c)', <value>, 'd)', <value>].
    A value cell can be plain text OR an embedded image (a diagram/labelled
    figure) instead of text — common for "identify the structure" questions.

  - "answer" tables: 2 columns, first cell a bare number, second cell
    "(letter)\n<explanation text>". Numbering is continuous across all
    answer tables in a doc (confirmed empirically — even when a doc has
    several such tables from page-break splitting), so they're merged into
    one {qnum: letter} map keyed by the literal printed number.

Images live in table cells as standard OOXML drawings; each is resolved via
the cell's r:embed relationship id against the document's part.rels (this
works for content embedded anywhere in the main document part, including
table cells — python-docx doesn't give cells their own part). .emf images
(a real fraction of the media in these docs) are decoded and re-saved as
.png via Pillow, which handles them out of the box.

Ambiguous cases (missing options, no answer-key entry, 2+ images in one
cell) are never guessed at — they go to the review file.

Run:  python extract_biology.py
"""

import re
import json
import sys
import zipfile
from pathlib import Path
from datetime import datetime, timezone

try:
    import docx
except ImportError:
    print("Run:  pip install python-docx")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Run:  pip install Pillow")
    sys.exit(1)

import io

_TEXT_NODE_RE = re.compile(
    r'<([wm]):t(?:\s[^>]*)?>(.*?)</\1:t>'  # text run
    r'|<w:tab\s*/>'                        # tab char — Word stores it as its own element, not "\t" in <w:t>
    r'|<w:(?:br|cr)\s*/>',                  # line/page break
    re.DOTALL,
)


def cell_full_text(cell) -> str:
    """cell.text (python-docx) only reads <w:t> runs — option/stem text typed
    inside a Word equation zone (common here for italic species names like
    'Escherichia coli', not real math) lives in <m:t> instead and is silently
    dropped by .text. Also restores tabs/line-breaks (their own elements, not
    literal characters) so e.g. a tab-separated answer key doesn't collapse
    into one run-on string. Pull all of it, in document order."""
    import html
    parts = []
    for m in _TEXT_NODE_RE.finditer(cell._tc.xml):
        if m.group(2) is not None:
            parts.append(html.unescape(m.group(2)))
        else:
            parts.append('\t')
    return "".join(parts)

# ── Config ────────────────────────────────────────────────────────────────────

DOCX_ROOT   = Path("pdfs/Biology/BIOLOGY QUESTION BANK")
OUTPUT_FILE = Path("output/biology_questions.json")
REVIEW_FILE = Path("output/biology_needs_review.json")
FIGURES_DIR = Path("output/figures_biology")

SUBJECT = "Biology"
STREAM  = "NEET"
SOURCE  = "Biology Question Bank v2"
CHAPTER_SUFFIX = " (New)"

QNUM_CELL_RE   = re.compile(r'^\s*(\d{1,4})\.\s*$')
ANS_NUM_CELL_RE = re.compile(r'^\s*(\d{1,4})\s*$')
OPT_LABEL_RE   = re.compile(r'^\s*([a-dA-D])\)\s*$')
ANS_LETTER_RE  = re.compile(r'^\s*\(([a-dA-D])\)')
COMPACT_ANS_RE = re.compile(r'(\d{1,4})\)\s*([a-dA-D])(?=\s|\d|$)')
LETTERS = ['A', 'B', 'C', 'D']


def clean_chapter_title(stem: str) -> str:
    name = re.sub(r'^\d+\.\s*', '', stem).strip()
    return name.title()


# ── Image resolution (docx relationship -> bytes, EMF -> PNG) ────────────────

def cell_images(cell, doc) -> list:
    """Returns [(ext, bytes), ...] for every embedded image in this cell,
    converting .emf to .png via Pillow."""
    rids = re.findall(r'r:embed="(rId\d+)"', cell._tc.xml)
    out = []
    for rid in rids:
        rel = doc.part.rels.get(rid)
        if rel is None:
            continue
        part = rel.target_part
        ext = part.partname.ext.lower()
        blob = part.blob
        if ext == "emf":
            try:
                im = Image.open(io.BytesIO(blob))
                im.load()
                buf = io.BytesIO()
                im.convert("RGB").save(buf, format="PNG")
                out.append(("png", buf.getvalue()))
            except Exception:
                out.append(("emf_failed", blob))
        else:
            out.append((ext, blob))
    return out


def save_image(data: bytes, dest_dir: Path, fname: str) -> str:
    dest_dir.mkdir(parents=True, exist_ok=True)
    fpath = dest_dir / fname
    with open(fpath, "wb") as f:
        f.write(data)
    return str(fpath)


# ── Table classification ──────────────────────────────────────────────────────

def classify_table(table) -> str:
    if not table.rows:
        return "other"
    cells = table.rows[0].cells
    ncols = len(cells)
    first_text = cell_full_text(cells[0])
    if ncols >= 4 and QNUM_CELL_RE.match(first_text):
        return "question"
    if ncols == 2 and ANS_NUM_CELL_RE.match(first_text) and ANS_LETTER_RE.match(cell_full_text(cells[1])):
        return "answer"
    # Compact format: a single cell packing "N)\tletter\tN)\tletter..." pairs —
    # used instead of the per-row rich table in some files (e.g. a doc with a
    # tab-separated ": ANSWER KEY :" block plus a separate, partial "HINTS AND
    # SOLUTIONS" table that only covers some questions and isn't authoritative).
    if len(cells) == 1 and COMPACT_ANS_RE.search(first_text):
        return "answer_compact"
    return "other"


# ── Answer-key parsing ─────────────────────────────────────────────────────────

def parse_answer_tables(answer_tables: list, compact_tables: list) -> dict:
    answers = {}
    for table in answer_tables:
        for row in table.rows:
            cells = row.cells
            if len(cells) != 2:
                continue
            num_m = ANS_NUM_CELL_RE.match(cell_full_text(cells[0]))
            letter_m = ANS_LETTER_RE.match(cell_full_text(cells[1]))
            if num_m and letter_m:
                answers[int(num_m.group(1))] = letter_m.group(1).upper()
    # Compact tables are the complete/authoritative key when present — applied
    # after so they win over any partial rich "hints" table for the same file.
    for table in compact_tables:
        text = cell_full_text(table.rows[0].cells[0])
        for m in COMPACT_ANS_RE.finditer(text):
            answers[int(m.group(1))] = m.group(2).upper()
    return answers


def row_option_labels(row) -> list:
    """Returns the option letters found in this row's label cells, [] if none
    (i.e. this row is stem/continuation content, not an option row)."""
    cells = row.cells
    found = []
    j = 0
    while j < len(cells) - 1:
        m = OPT_LABEL_RE.match(cell_full_text(cells[j]))
        if m:
            found.append(m.group(1).upper())
            j += 2
        else:
            j += 1
    return found


# ── Question parsing ──────────────────────────────────────────────────────────

def parse_question_tables(question_tables: list, doc, chapter_title: str) -> list:
    """Walk every row of every question table, in order, grouping rows into
    per-question chunks (from a 'N.' row to just before the next one)."""
    all_rows = []
    for table in question_tables:
        all_rows.extend(table.rows)

    chunks = []  # [(qnum, [rows])]
    current = None
    for row in all_rows:
        cells = row.cells
        m = QNUM_CELL_RE.match(cell_full_text(cells[0])) if cells else None
        if m:
            if current is not None:
                chunks.append(current)
            current = (int(m.group(1)), [row])
        elif current is not None:
            current[1].append(row)
    if current is not None:
        chunks.append(current)

    raw_questions = []
    for qnum, rows in chunks:
        option_rows = [r for r in rows if row_option_labels(r)]
        stem_rows = [r for r in rows if r not in option_rows]

        # Stem text: first non-empty cell from cols[1:] of the question-number row.
        stem_cells0 = rows[0].cells[1:]
        stem_text = next((t for c in stem_cells0 if (t := cell_full_text(c).strip())), "")

        # Stem images: scan every stem/continuation row's cells (a standalone
        # figure often sits on its own row, not the question-number row itself).
        # Cells within one row are duplicate padding of the same content (like
        # the repeated stem text), so only the first image-bearing cell per
        # row counts — otherwise one real figure looks like N candidates.
        stem_images = []
        for r in stem_rows:
            for c in r.cells:
                imgs = cell_images(c, doc)
                if imgs:
                    stem_images.extend(imgs)
                    break

        options = {}
        option_images = {}
        option_issue = []
        for row in option_rows:
            cells = row.cells
            j = 0
            while j < len(cells) - 1:
                label_m = OPT_LABEL_RE.match(cell_full_text(cells[j]))
                if label_m:
                    letter = label_m.group(1).upper()
                    value_cell = cells[j + 1]
                    text_val = cell_full_text(value_cell).strip()
                    imgs = cell_images(value_cell, doc)
                    if len(imgs) > 1:
                        option_issue.append(f"{letter}: {len(imgs)} images in one cell")
                    elif imgs:
                        ext, data = imgs[0]
                        if ext == "emf_failed":
                            option_issue.append(f"{letter}: EMF decode failed")
                        else:
                            option_images[letter] = (ext, data)
                    elif text_val:
                        options[letter] = text_val
                    else:
                        option_issue.append(f"{letter}: no text and no image")
                    j += 2
                else:
                    j += 1

        raw_questions.append({
            "qnum": qnum,
            "stem": stem_text,
            "stem_images": stem_images,
            "options": options,
            "option_images": option_images,
            "option_issue": option_issue,
        })
    return raw_questions


# ── Per-file extraction ────────────────────────────────────────────────────────

def extract_docx(path: Path) -> tuple[list, list]:
    print(f"\n  {path.name}")
    doc = docx.Document(str(path))
    chapter_title = clean_chapter_title(path.stem)

    classified = [(t, classify_table(t)) for t in doc.tables]
    question_tables = [t for t, c in classified if c == "question"]
    answer_tables = [t for t, c in classified if c == "answer"]
    compact_tables = [t for t, c in classified if c == "answer_compact"]

    if not question_tables:
        print("      no question table found — skipping")
        return [], [{"file": path.name, "qnum": None, "reason": "no question table found"}]

    answers = parse_answer_tables(answer_tables, compact_tables)
    raw_questions = parse_question_tables(question_tables, doc, chapter_title)

    fig_dir = FIGURES_DIR / re.sub(r'[^\w]', '_', path.stem)
    questions = []
    review = []

    for rq in raw_questions:
        qnum = rq["qnum"]
        reasons = list(rq["option_issue"])
        if len(rq["stem_images"]) > 1:
            reasons.append(f"stem: {len(rq['stem_images'])} candidate images")
        if not rq["stem"] and not rq["stem_images"]:
            reasons.append("empty stem")
        n_opts_found = len(rq["options"]) + len(rq["option_images"])
        if n_opts_found < 4:
            reasons.append(f"only {n_opts_found}/4 options parsed")
        letter = answers.get(qnum)
        if not letter:
            reasons.append("no answer-key entry for this question number")

        if reasons:
            review.append({
                "file": path.name,
                "chapter": chapter_title,
                "qnum": qnum,
                "stem": rq["stem"],
                "options": rq["options"],
                "hasOptionImages": list(rq["option_images"].keys()),
                "hasStemImage": len(rq["stem_images"]) > 0,
                "answerLetter": letter,
                "reason": "; ".join(reasons),
            })
            continue

        q = {
            "question": rq["stem"],
            "options": {L: rq["options"].get(L, "") for L in LETTERS},
            "answer": letter,
            "questionType": "single",
            "subject": SUBJECT,
            "chapter": chapter_title,
        }
        if rq["stem_images"]:
            ext, data = rq["stem_images"][0]
            fname = f"q{qnum}_stem.{ext}"
            save_image(data, fig_dir, fname)
            q["imageLocalPath"] = str(fig_dir / fname)
        if rq["option_images"]:
            opt_paths = {}
            for L, (ext, data) in rq["option_images"].items():
                fname = f"q{qnum}_opt{L}.{ext}"
                save_image(data, fig_dir, fname)
                opt_paths[L] = str(fig_dir / fname)
            q["optionImageLocalPaths"] = opt_paths
        questions.append(q)

    print(f"      {len(questions)} clean, {len(review)} flagged for review (of {len(raw_questions)} total)")
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
    print("\nPrepMind Biology Question Bank Extractor\n")

    OUTPUT_FILE.parent.mkdir(exist_ok=True)

    if not DOCX_ROOT.exists():
        print(f"{DOCX_ROOT}/ not found.")
        sys.exit(1)

    files = sorted(DOCX_ROOT.rglob("*.docx"))
    file_arg = sys.argv[1] if len(sys.argv) > 1 else None
    if file_arg:
        files = [f for f in files if f.name == file_arg]
        if not files:
            print(f"No file named {file_arg} found under {DOCX_ROOT}")
            sys.exit(1)

    all_questions = []
    all_review = []
    for f in files:
        qs, rev = extract_docx(f)
        qs = tag_questions(qs)
        all_questions.extend(qs)
        all_review.extend(rev)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(all_questions, out, indent=2, ensure_ascii=False)
    with open(REVIEW_FILE, "w", encoding="utf-8") as out:
        json.dump(all_review, out, indent=2, ensure_ascii=False)

    print(f"\n{'-' * 50}")
    print("Done!")
    print(f"    Files processed : {len(files)}")
    print(f"    Clean questions : {len(all_questions)}")
    print(f"    Needs review    : {len(all_review)}")
    with_img = sum(1 for q in all_questions if q.get("imageLocalPath") or q.get("optionImageLocalPaths"))
    print(f"    (of which with at least one image: {with_img})")
    print(f"\n    Output -> {OUTPUT_FILE}")
    print(f"    Review -> {REVIEW_FILE}")


if __name__ == "__main__":
    main()
