#!/usr/bin/env python3
"""
PrepMind — JEE Main PYQ Extraction Script (Vedantu-format papers)
===================================================================
Extracts questions from "Question: ... Options: ... Answer: (x)" style PDFs
(Vedantu-sourced JEE Main memory-based papers) — a different layout from the
numbered "Q.1 (A)(B)(C)(D)" ALLEN format that extract.py handles.

Handles:
  - Single-subject files (2024 Physics/Chemistry/Maths) — subject from filename.
  - Combined-subject files (2020/2025/2026) — subject from in-body section
    headers ("Physics" / "Chemistry" / "Mathematics" on their own line).
  - MCQ questions (4 lettered options) AND numeric-answer questions (no
    options, just "Answer: (25)") — both are real JEE Main question types.
  - Per-OPTION diagrams: some options are plain text, some are drawn
    structures/graphs (common in organic chemistry "identify the product" and
    physics "which plot" questions) — sometimes mixed within the same
    question (2 text options + 2 diagram options). Each option is tracked as
    its own mini-region between its "(x)" marker and the next, across text
    AND images, so a diagram option gets its own optionImages[X] rather than
    the whole question falling back to one generic image.
  - The question stem's own diagram (e.g. a ray diagram before the options)
    is handled the same way, one level up.
  - Repeating logo/watermark images (same xref reused across many pages) are
    filtered out at the image-discovery stage, before any of the above.
  - Anything that can't be resolved unambiguously (a stem or option region
    with 2+ candidate images, or an option with neither text nor an image) is
    NOT guessed at — it's logged to a review file instead of importing a
    broken or wrong question.

Does NOT handle: 2021/2022/2023 papers (OCR'd scans with garbled/duplicated
text ordering — "Q1:" numbering, option-letters appearing before their own
option text) or the mathongo "Mathematics in Physics" compilation (no real
text layer, just ad copy around question images), or the 2020 Jan 7 Shift 1
paper (no inline answer key, garbled formulas). Those need a different
approach (page-image → Gemini vision) and are intentionally left out rather
than silently mis-parsed.

Run:  python extract_pyq.py
"""

import re
import json
import sys
from collections import Counter
from pathlib import Path
from datetime import datetime

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Run:  pip install PyMuPDF")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

PDF_ROOT      = Path("pdfs/pyq")
OUTPUT_FILE   = Path("output/pyq_questions.json")
REVIEW_FILE   = Path("output/pyq_needs_image_review.json")
FIGURES_DIR   = Path("output/figures_pyq")
REVIEW_ASSETS_DIR = Path("output/review_assets_pyq")
MIN_FIGURE_PX = 40
MAX_IMAGE_AREA_RATIO = 0.7   # skip images covering most of the page (background scans)
LOGO_PAGE_FRACTION   = 0.3   # an xref reused on >30% of pages is a repeating logo/watermark

# filename -> (year, shift, subject-or-None). subject=None means "detect from
# in-body section headers" (combined-subject paper).
FILES_META = {
    "JEE Main 2024 (April 9 Shift 2) Maths Question Paper with Solutions [PDF].pdf":
        {"year": 2024, "shift": "April 9 Shift 2", "subject": "Mathematics"},
    "JEE Main 2024 (April 9 Shift 2) Chemistry Question Paper with Solutions [PDF].pdf":
        {"year": 2024, "shift": "April 9 Shift 2", "subject": "Chemistry"},
    "JEE Main 2024 (April 9 Shift 2) Physics Question Paper with Solutions [PDF].pdf":
        {"year": 2024, "shift": "April 9 Shift 2", "subject": "Physics"},
    # NOTE: "JEE Main 2020 January 7 Shift 1 Question Paper with Answer Key.pdf"
    # is intentionally excluded — it has zero inline "Answer:" markers (answers
    # only live in prose worked-solutions text with no stated final choice) and
    # its formulas are garbled by the same OCR/font-encoding issue as the
    # 2021-2023 papers (e.g. option text renders as symbol soup). Needs a
    # different approach (page-image -> Gemini vision), not this text parser.
    "JEE Main 2025 April 2 Shift 1 Question Paper and Solutions PDF _ Vedantu.pdf":
        {"year": 2025, "shift": "April 2 Shift 1", "subject": None},
    "JEE Main 2026 April 8 Shift 2 Question Paper with Answer Key, Solutions PDF, and Analysis.pdf":
        {"year": 2026, "shift": "April 8 Shift 2", "subject": None},
}

SUBJECT_HEADER_RE = re.compile(r'^[ \t]*(Physics|Chemistry|Mathematics|Maths)[ \t]*$', re.IGNORECASE | re.MULTILINE)
SUBJECT_ALIASES = {"maths": "Mathematics"}
SOLUTIONS_MARKER_RE = re.compile(r'^[ \t]*SOLUTIONS?[ \t]*$', re.IGNORECASE | re.MULTILINE)
QUESTION_MARKER_RE = re.compile(r'Question[ \t]*\d*[ \t]*:[ \t]*')
OPTIONS_MARKER_RE = re.compile(r'Options:[ \t]*')
OPTION_LETTER_RE = re.compile(r'\(([A-Da-d])\)')
ANSWER_RE = re.compile(r'Answer:?[ \t]*\(([^)]+)\)', re.IGNORECASE)
LETTERS = ['A', 'B', 'C', 'D']

# ── Text normalisation ────────────────────────────────────────────────────────

def normalize(text: str) -> str:
    text = text.replace('​', '').replace('\xa0', ' ')
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()

# ── Image filtering (logos/watermarks, across the whole doc) ──────────────────

def logo_xrefs(doc) -> set:
    """xrefs that recur on more than LOGO_PAGE_FRACTION of pages — treated as
    repeating watermark/logo images, not real question diagrams."""
    counts = Counter()
    for page in doc:
        for xref, *_ in page.get_images(full=True):
            counts[xref] += 1
    threshold = max(2, int(len(doc) * LOGO_PAGE_FRACTION))
    return {xref for xref, c in counts.items() if c > threshold}


def build_events(doc, skip_xrefs: set) -> list:
    """Returns an ordered list of ('text', str) / ('image', page_num, xref) tuples,
    walking every page top-to-bottom, images interleaved at their real vertical
    position among the text blocks."""
    events = []
    for page_num, page in enumerate(doc):
        page_area = page.rect.width * page.rect.height
        items = []  # (y0, kind, payload)

        for block in page.get_text("blocks"):
            y0, block_text = block[1], block[4]
            if block_text.strip():
                items.append((y0, "text", block_text))

        for xref, *_ in page.get_images(full=True):
            if xref in skip_xrefs:
                continue
            rects = page.get_image_rects(xref)
            if not rects:
                continue
            rect = rects[0]
            if rect.width < MIN_FIGURE_PX or rect.height < MIN_FIGURE_PX:
                continue
            if (rect.width * rect.height) / page_area > MAX_IMAGE_AREA_RATIO:
                continue
            items.append((rect.y0, "image", (page_num, xref)))

        items.sort(key=lambda t: t[0])
        for _, kind, payload in items:
            events.append((kind, payload))
    return events

# ── Per-file extraction ────────────────────────────────────────────────────────
#
# State machine per question, walking the document's event stream once:
#   'pre'      — before the first "Question:" of the whole document
#   'stem'     — collecting question text, before "Options:"
#   'opts_pre' — after "Options:", before the first "(a)" marker
#   'opt_A'..'opt_D' — collecting that option's text/images
#   'post'     — after "Answer:", before the next "Question:" (discarded —
#                this is worked-solution text we don't need)
#
# Text is appended to whichever buffer is active. Images are attributed to
# the stem if seen during 'stem'/'opts_pre' (a question-level diagram), or to
# the specific option if seen during 'opt_X'.

def extract_pdf(path: Path, meta: dict) -> tuple[list, list]:
    print(f"\n  {path.name}")
    doc = fitz.open(str(path))

    skip_xrefs = logo_xrefs(doc)
    events = build_events(doc, skip_xrefs)

    out_dir = FIGURES_DIR / re.sub(r'[^\w]', '_', path.stem)
    review_dir = REVIEW_ASSETS_DIR / re.sub(r'[^\w]', '_', path.stem)

    def save_image(page_num: int, xref: int, dest_dir: Path, fname: str) -> str | None:
        try:
            base = doc.extract_image(xref)
        except Exception:
            return None
        dest_dir.mkdir(parents=True, exist_ok=True)
        fpath = dest_dir / fname
        with open(fpath, "wb") as f:
            f.write(base["image"])
        return str(fpath)

    questions = []
    review = []
    review_counter = [0]

    current_subject = meta["subject"]  # None until first header seen, for combined papers
    stage = "pre"
    stem_text: list[str] = []
    stem_images: list[tuple[int, int]] = []
    opt_text: dict[str, list[str]] = {L: [] for L in LETTERS}
    opt_images: dict[str, list[tuple[int, int]]] = {L: [] for L in LETTERS}
    # Images inside the Options region are held here until we know which
    # letter they belong to — this layout puts an image-option's picture
    # ABOVE its own "(a)" label (opposite of text options, where the label
    # comes first), so an image seen at stage 'opts_pre'/'opt_X' is deferred
    # and attributed to whichever letter is entered NEXT, not the current one.
    pending_option_images: list[tuple[int, int]] = []
    answer_raw = [None]
    stopped = False

    def reset_question_state():
        nonlocal stem_text, stem_images, opt_text, opt_images, answer_raw, pending_option_images
        stem_text = []
        stem_images = []
        opt_text = {L: [] for L in LETTERS}
        opt_images = {L: [] for L in LETTERS}
        pending_option_images = []
        answer_raw = [None]

    def new_review_id() -> str:
        review_counter[0] += 1
        return f"{meta['year']}_{re.sub(r'[^A-Za-z0-9]', '', path.stem)}_q{review_counter[0]}"

    def finalize():
        """Called when an 'Answer:' marker is hit — resolves the just-completed
        question (or drops/flags it) and resets state for the next one."""
        nonlocal stage
        q_text = normalize("".join(stem_text))
        raw_ans = (answer_raw[0] or "").strip()

        if not q_text or len(q_text) < 8 or not raw_ans:
            reset_question_state()
            stage = "post"
            return

        is_mcq = any(opt_text[L] or opt_images[L] for L in LETTERS)

        if not is_mcq:
            # numeric-answer question: no option markers were ever seen.
            if re.fullmatch(r'-?\d+(\.\d+)?', raw_ans) and current_subject:
                questions.append({
                    "question": q_text,
                    "options": {L: "" for L in LETTERS},
                    "answer": raw_ans,
                    "questionType": "numeric",
                    "subject": current_subject,
                })
                attach_stem_image(questions[-1])
            reset_question_state()
            stage = "post"
            return

        if not current_subject:
            reset_question_state()
            stage = "post"
            return

        options = {}
        option_images_local = {}
        needs_review = False
        review_reason_parts = []

        for L in LETTERS:
            text_val = normalize("".join(opt_text[L]))
            text_val = re.split(r"\n", text_val)[0].strip() if text_val else ""
            imgs = opt_images[L]
            if text_val:
                options[L] = text_val
            elif len(imgs) == 1:
                options[L] = ""
                page_num, xref = imgs[0]
                path_ = save_image(page_num, xref, out_dir, f"opt{L}_p{page_num}_x{xref}.png")
                if path_:
                    option_images_local[L] = path_
                else:
                    needs_review = True
                    review_reason_parts.append(f"{L}: image extract failed")
            elif len(imgs) == 0:
                needs_review = True
                review_reason_parts.append(f"{L}: no text and no image found")
            else:
                needs_review = True
                review_reason_parts.append(f"{L}: {len(imgs)} candidate images, ambiguous")

        # Resolve the answer to a letter: normally it's already a letter (or
        # 1-4), but some source pages print the answer key as the option's
        # VALUE instead of its letter (e.g. options are 22/16/5/1 and the key
        # just says "Answer: (22)") — fall back to matching option text.
        ans = raw_ans.upper()
        if ans in "1234":
            ans = LETTERS[int(ans) - 1]
        if ans not in LETTERS:
            norm_ans = re.sub(r"\s+", "", raw_ans.strip().lower())
            match = next((L for L, v in options.items() if re.sub(r"\s+", "", v.lower()) == norm_ans), None)
            if match:
                ans = match
            else:
                reset_question_state()
                stage = "post"
                return

        stem_img_count = len(stem_images)
        stem_image_local = None
        if stem_img_count == 1:
            page_num, xref = stem_images[0]
            stem_image_local = save_image(page_num, xref, out_dir, f"p{page_num}_x{xref}.png")
        elif stem_img_count > 1:
            needs_review = True
            review_reason_parts.append(f"stem: {stem_img_count} candidate images, ambiguous")

        if needs_review:
            rid = new_review_id()
            all_images = stem_images + [img for L in LETTERS for img in opt_images[L]]
            candidates = []
            for i, (page_num, xref) in enumerate(all_images):
                p = save_image(page_num, xref, review_dir, f"{rid}_cand{i}_p{page_num}_x{xref}.png")
                if p:
                    candidates.append(p)
            pages = []
            for page_num in sorted(set(p for p, _ in all_images)):
                fname = f"{rid}_page{page_num}.png"
                fpath = review_dir / fname
                review_dir.mkdir(parents=True, exist_ok=True)
                doc[page_num].get_pixmap(dpi=120).save(str(fpath))
                pages.append(str(fpath))
            review.append({
                "id": rid,
                "question": q_text,
                "subject": current_subject,
                "options": options,
                "answer": ans,
                "reason": "; ".join(review_reason_parts),
                "candidateImagePaths": candidates,
                "pageRenderPaths": pages,
            })
        else:
            q = {
                "question": q_text,
                "options": options,
                "answer": ans,
                "questionType": "single",
                "subject": current_subject,
            }
            if stem_image_local:
                q["imageLocalPath"] = stem_image_local
            if option_images_local:
                q["optionImageLocalPaths"] = option_images_local
            questions.append(q)

        reset_question_state()
        stage = "post"

    def attach_stem_image(q: dict):
        if len(stem_images) == 1:
            page_num, xref = stem_images[0]
            p = save_image(page_num, xref, out_dir, f"p{page_num}_x{xref}.png")
            if p:
                q["imageLocalPath"] = p

    for kind, payload in events:
        if stopped:
            break

        if kind == "image":
            page_num, xref = payload
            if stage == "stem":
                stem_images.append((page_num, xref))
            elif stage == "opts_pre" or stage.startswith("opt_"):
                pending_option_images.append((page_num, xref))
            # 'pre'/'post': not inside a question we care about, drop it
            continue

        text = payload
        if SOLUTIONS_MARKER_RE.search(text):
            stopped = True
            break

        # Collect every marker relevant to the CURRENT parse position, in the
        # order they appear in this block, and walk through them one at a time
        # (a single text block can contain several: a subject header, a
        # "Question:", its "Options:", one or more "(x)" letters, "Answer:" —
        # all of it, for short questions).
        markers = []
        if meta["subject"] is None:
            for m in SUBJECT_HEADER_RE.finditer(text):
                markers.append((m.start(), m.end(), "header", m.group(1)))
        for m in QUESTION_MARKER_RE.finditer(text):
            markers.append((m.start(), m.end(), "question", None))
        for m in OPTIONS_MARKER_RE.finditer(text):
            markers.append((m.start(), m.end(), "options", None))
        for m in OPTION_LETTER_RE.finditer(text):
            markers.append((m.start(), m.end(), "letter", m.group(1).upper()))
        for m in ANSWER_RE.finditer(text):
            markers.append((m.start(), m.end(), "answer", m.group(1)))
        markers.sort(key=lambda t: t[0])

        def emit(segment: str):
            if not segment:
                return
            if stage == "stem":
                stem_text.append(segment)
            elif stage.startswith("opt_"):
                opt_text[stage[-1]].append(segment)
            # 'pre' / 'opts_pre' / 'post': discarded

        if not markers:
            emit(text)
            continue

        pos = 0
        for start, end, mkind, value in markers:
            if start > pos:
                emit(text[pos:start])

            if mkind == "header":
                name = value.lower()
                current_subject = SUBJECT_ALIASES.get(name, value.capitalize())
            elif mkind == "question":
                reset_question_state()
                stage = "stem"
            elif mkind == "options":
                if stage == "stem":
                    stage = "opts_pre"
            elif mkind == "letter":
                already_seen = [L for L in LETTERS if opt_text[L] or opt_images[L]]
                next_expected = LETTERS[len(already_seen)] if len(already_seen) < 4 else None
                if stage in ("opts_pre", "opt_A", "opt_B", "opt_C", "opt_D") and value == next_expected:
                    # Images seen since the previous letter (or since "Options:")
                    # belong to the letter we're now entering, not the one we're
                    # leaving — see the pending_option_images comment above.
                    opt_images[value].extend(pending_option_images)
                    pending_option_images = []
                    stage = f"opt_{value}"
            elif mkind == "answer":
                if stage in ("opts_pre", "opt_A", "opt_B", "opt_C", "opt_D", "stem"):
                    if stage.startswith("opt_") and pending_option_images:
                        opt_images[stage[-1]].extend(pending_option_images)
                        pending_option_images = []
                    answer_raw[0] = value
                    finalize()

            pos = end
        if pos < len(text):
            emit(text[pos:])

    doc.close()

    matched = sum(1 for q in questions if q.get("imageLocalPath") or q.get("optionImageLocalPaths"))
    print(f"      {len(questions)} questions extracted, {matched} with at least one figure, "
          f"{len(review)} need manual image review")
    return questions, review

# ── Metadata tagging ──────────────────────────────────────────────────────────

def tag_questions(questions: list, meta: dict) -> list:
    chapter = f"JEE Main {meta['year']} PYQ"
    now = datetime.utcnow().isoformat()
    for q in questions:
        q["chapter"] = chapter
        q["topic"] = meta["shift"]
        q["stream"] = "JEE"
        q["source"] = "JEE Main PYQ"
        q["isPYQ"] = True
        q.setdefault("difficulty", "Medium")
        q["createdAt"] = now
    return questions

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\nPrepMind JEE Main PYQ Extractor\n")

    OUTPUT_FILE.parent.mkdir(exist_ok=True)

    if not PDF_ROOT.exists():
        print(f"{PDF_ROOT}/ not found.")
        sys.exit(1)

    files = sorted(PDF_ROOT.glob("*.pdf"))
    unknown = [f for f in files if f.name not in FILES_META]
    if unknown:
        print("Skipping unrecognised files (add to FILES_META to include):")
        for f in unknown:
            print(f"    - {f.name}")

    all_questions: list = []
    all_review: list = []
    stats: dict[str, int] = {}

    for f in files:
        meta = FILES_META.get(f.name)
        if not meta:
            continue
        questions, review = extract_pdf(f, meta)
        questions = tag_questions(questions, meta)
        all_questions.extend(questions)
        for r in review:
            r["file"] = f.name
        all_review.extend(review)
        for q in questions:
            key = f"{q['subject']} — {q['chapter']}"
            stats[key] = stats.get(key, 0) + 1

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(all_questions, out, indent=2, ensure_ascii=False)
    with open(REVIEW_FILE, "w", encoding="utf-8") as out:
        json.dump(all_review, out, indent=2, ensure_ascii=False)

    print(f"\n{'-' * 50}")
    print(f"Done!")
    print(f"    Total questions : {len(all_questions)}")
    for key, count in sorted(stats.items()):
        print(f"    {key:<35}: {count}")
    numeric = sum(1 for q in all_questions if q.get("questionType") == "numeric")
    with_figure = sum(1 for q in all_questions if q.get("imageLocalPath") or q.get("optionImageLocalPaths"))
    print(f"    (of which numeric-answer type: {numeric}, with at least one figure: {with_figure})")
    print(f"\n    Output → {OUTPUT_FILE}")
    print(f"    Needs manual image review → {REVIEW_FILE} ({len(all_review)} question(s))")
    print(f"    Next step: python import_firestore.py output/pyq_questions.json\n")


if __name__ == "__main__":
    main()
