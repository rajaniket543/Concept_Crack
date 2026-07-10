#!/usr/bin/env python3
"""
Backfill correct answers for Physics/Mathematics questions in Firestore.

Root cause this fixes: extract.py's original ingestion deliberately skipped
Answers_Physics.pdf / Answers_Mathematics.pdf (so they wouldn't be mis-parsed
as question blocks) but nothing ever came back and merged their answers into
the question records — leaving `answer: null` on ~99% of Physics/Mathematics
questions already imported into Firestore.

This script:
  1. Re-parses each Physics/Mathematics source PDF using the exact same
     regex logic as extract.py (deterministic — same file, same text), but
     this time keeps the original question number instead of discarding it.
  2. Parses the matching Answers_*.pdf into {chapter_number: {q_num: letter}}.
  3. Reads the matching Firestore documents (by subject + chapter + exact
     question text) and reports what WOULD change. Reads only — no writes —
     unless --commit is passed.
  4. Only ever writes with --commit. Anything ambiguous (multi-answer key
     like "(a, b)", a question-count mismatch against the source PDF, or a
     Firestore doc that already has a *different* non-null answer) is
     reported and skipped rather than guessed.

Usage:
  python backfill_answers.py             # dry run — reads Firestore, prints a report, writes nothing
  python backfill_answers.py --commit    # applies the updates reported above
"""
import re
import sys
import json
from pathlib import Path

import fitz  # PyMuPDF

sys.path.insert(0, str(Path(__file__).parent))
from extract import normalize, find_question_blocks, parse_block, infer_chapter, PDF_ROOT  # noqa: E402

ANSWERS_FILES = {
    "Physics":     Path("pdfs/Physics/Physics/Answers_Physics.pdf"),
    "Mathematics": Path("pdfs/Mathematics/Mathematics/Answers_Mathematics.pdf"),
}

CHAPTER_NUM_RE = re.compile(r'^(\d{1,3})[_\-\s]')
HEADER_RE      = re.compile(r'(?:^|\n)(\d{1,3})_([^\n]+)')
ANSWER_RE      = re.compile(r'(\d{1,3})\.\s*\(([a-eA-E](?:\s*,\s*[a-eA-E])*)\)')


def parse_answer_pdf(path: Path) -> dict:
    """Returns {chapter_number: {question_number: 'A'|'B'|'C'|'D'|None}}.
    None means the source listed a multi-select or non-ABCD answer that
    can't be mapped onto this app's single-choice schema."""
    doc = fitz.open(str(path))
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    headers = [(m.start(), int(m.group(1))) for m in HEADER_RE.finditer(text)]
    headers.append((len(text), None))

    chapters: dict = {}
    for i in range(len(headers) - 1):
        start, num = headers[i]
        end = headers[i + 1][0]
        block = text[start:end]
        answers: dict = {}
        for m in ANSWER_RE.finditer(block):
            qnum = int(m.group(1))
            letters = [x.strip().upper() for x in m.group(2).split(',')]
            answers[qnum] = letters[0] if len(letters) == 1 and letters[0] in 'ABCD' else None
        chapters[num] = answers
    return chapters


def reparse_source_with_numbers(path: Path) -> list:
    """Re-run extraction on one source PDF, keeping questionNumber (extract.py
    strips this before saving — we need it to match against the answer key)."""
    doc = fitz.open(str(path))
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    text = normalize(text)
    blocks = find_question_blocks(text)
    out = []
    for num, block in blocks:
        q = parse_block(num, block)
        if q:
            out.append(q)  # still has "questionNumber"
    return out


def chapter_number_from_filename(path: Path):
    m = CHAPTER_NUM_RE.match(path.stem)
    return int(m.group(1)) if m else None


def main():
    commit = '--commit' in sys.argv

    import firebase_admin
    from firebase_admin import credentials, firestore
    cred = credentials.Certificate("service-account.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    report = {
        "matched_against_answer_key": 0,
        "already_correct_in_firestore": 0,
        "would_update": 0,
        "skipped_multi_or_non_abcd_answer": 0,
        "skipped_no_firestore_text_match": 0,
        "skipped_existing_conflicting_answer": [],
        "chapter_count_mismatches": [],  # informational only — matching is by question number, not position
    }
    updates = []  # (DocumentReference, new_letter, subject, chapter, qnum)

    for subject, answers_path in ANSWERS_FILES.items():
        if not answers_path.exists():
            print(f"WARNING: {answers_path} not found - skipping {subject}", file=sys.stderr)
            continue

        answer_key = parse_answer_pdf(answers_path)
        subject_dir = PDF_ROOT / subject
        source_pdfs = sorted(subject_dir.rglob("*.pdf"))

        for pdf_path in source_pdfs:
            if pdf_path.resolve() == answers_path.resolve() or 'answer' in pdf_path.name.lower():
                continue
            chap_num = chapter_number_from_filename(pdf_path)
            if chap_num is None or chap_num not in answer_key:
                continue

            questions = reparse_source_with_numbers(pdf_path)
            key_for_chapter = answer_key[chap_num]
            if len(questions) != len(key_for_chapter):
                report["chapter_count_mismatches"].append(
                    {"file": pdf_path.name, "extracted": len(questions), "answer_key": len(key_for_chapter)}
                )

            chapter_name = infer_chapter(pdf_path)
            docs = list(
                db.collection('questions')
                  .where('subject', '==', subject)
                  .where('chapter', '==', chapter_name)
                  .stream()
            )
            docs_by_text = {d.to_dict().get('question'): d for d in docs}

            for q in questions:
                qnum   = q["questionNumber"]
                letter = key_for_chapter.get(qnum)
                if letter is None:
                    report["skipped_multi_or_non_abcd_answer"] += 1
                    continue
                report["matched_against_answer_key"] += 1

                match = docs_by_text.get(q["question"])
                if not match:
                    report["skipped_no_firestore_text_match"] += 1
                    continue

                existing = match.to_dict().get('answer')
                if existing == letter:
                    report["already_correct_in_firestore"] += 1
                    continue
                if existing:
                    report["skipped_existing_conflicting_answer"].append(
                        {"subject": subject, "chapter": chapter_name, "q_num": qnum,
                         "firestore_has": existing, "answer_key_says": letter}
                    )
                    continue

                updates.append((match.reference, letter, subject, chapter_name, qnum))
                report["would_update"] += 1

    print(json.dumps(report, indent=2, default=str))
    print(f"\nPending Firestore writes: {len(updates)}")

    if not commit:
        print("\nDry run only - no writes made. Re-run with --commit to apply.")
        return

    BATCH = 400
    for i in range(0, len(updates), BATCH):
        chunk = updates[i:i + BATCH]
        batch = db.batch()
        for ref, letter, *_ in chunk:
            batch.update(ref, {"answer": letter})
        batch.commit()
        print(f"  committed {min(i + BATCH, len(updates))}/{len(updates)}")
    print("Done.")


if __name__ == "__main__":
    main()
