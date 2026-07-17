#!/usr/bin/env python3
"""
Find (and optionally delete) questions in Firestore with a missing or
broken answer/options.

"Broken" means any of:
  - answer is missing, null, or empty
  - answer is not one of A/B/C/D
  - options is missing, not an object, or doesn't have all of A/B/C/D
  - one of the option texts is missing/blank

Usage:
  python clean_broken_answers.py             # dry run — reports only, writes nothing
  python clean_broken_answers.py --commit    # deletes every question flagged broken
"""
import json
import sys
from collections import Counter

import firebase_admin
from firebase_admin import credentials, firestore

VALID_LETTERS = {"A", "B", "C", "D"}


def why_broken(data: dict) -> str | None:
    answer = data.get("answer")
    if not answer or not isinstance(answer, str) or answer.strip().upper() not in VALID_LETTERS:
        return "missing_or_invalid_answer"

    options = data.get("options")
    if not isinstance(options, dict):
        return "missing_options"

    for letter in ("A", "B", "C", "D"):
        text = options.get(letter)
        if not text or not isinstance(text, str) or not text.strip():
            return "incomplete_options"

    if answer.strip().upper() not in options:
        return "answer_not_in_options"

    return None


def main():
    commit = "--commit" in sys.argv

    cred = credentials.Certificate("service-account.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    total = 0
    broken = []  # (doc_id, reason, subject, chapter)
    broken_full = []  # full doc data, kept as a restore backup before any delete
    reason_counts = Counter()
    subject_counts = Counter()

    print("Scanning questions collection...")
    PAGE = 500
    query = db.collection("questions").order_by("__name__").limit(PAGE)
    last_doc = None
    while True:
        q = query.start_after(last_doc) if last_doc is not None else query
        for attempt in range(5):
            try:
                docs = list(q.stream())
                break
            except Exception as e:
                if attempt == 4:
                    raise
                print(f"  (retrying page after transient error: {e.__class__.__name__})")
        if not docs:
            break
        for doc in docs:
            total += 1
            data = doc.to_dict()
            reason = why_broken(data)
            if reason:
                broken.append((doc.id, reason, data.get("subject"), data.get("chapter")))
                broken_full.append({"id": doc.id, "reason": reason, **data})
                reason_counts[reason] += 1
                subject_counts[data.get("subject") or "Unknown"] += 1
        last_doc = docs[-1]
        if total % 1000 == 0 or len(docs) < PAGE:
            print(f"  scanned {total}...")

    print(f"\nScanned {total} questions total.")
    print(f"Broken: {len(broken)} ({len(broken) / total * 100:.1f}%)\n")

    print("By reason:")
    for reason, count in reason_counts.most_common():
        print(f"  {reason:28s} {count}")

    print("\nBy subject:")
    for subject, count in subject_counts.most_common():
        print(f"  {subject:20s} {count}")

    report_path = "broken_questions_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(
            [{"id": i, "reason": r, "subject": s, "chapter": c} for i, r, s, c in broken],
            f, indent=2,
        )
    print(f"\nFull list of broken doc IDs written to {report_path}")

    backup_path = "broken_questions_backup.json"
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(broken_full, f, indent=2, default=str)
    print(f"Full document backup (for restore if needed) written to {backup_path}")

    if not commit:
        print("\nDry run only - no deletes made. Re-run with --commit to delete these documents.")
        return

    print(f"\nDeleting {len(broken)} broken questions...")
    BATCH = 400
    for i in range(0, len(broken), BATCH):
        chunk = broken[i:i + BATCH]
        batch = db.batch()
        for doc_id, *_ in chunk:
            batch.delete(db.collection("questions").document(doc_id))
        batch.commit()
        print(f"  deleted {min(i + BATCH, len(broken))}/{len(broken)}")
    print("Done.")


if __name__ == "__main__":
    main()
