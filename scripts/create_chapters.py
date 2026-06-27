#!/usr/bin/env python3
"""
PrepMind — Create Chapter Metadata in Firestore
================================================
Reads output/all_questions.json and writes one document per unique
subject+chapter to the 'chapters' Firestore collection.
This powers the Practice page chapter listing.

Run:  python create_chapters.py
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌  Run:  pip install firebase-admin")
    sys.exit(1)

SERVICE_ACCOUNT = Path("service-account.json")
INPUT_FILE      = Path("output/all_questions.json")
COLLECTION      = "chapters"
BATCH_SIZE      = 499


def main():
    print("\n🚀  PrepMind Chapter Metadata Creator\n")

    if not SERVICE_ACCOUNT.exists():
        print("❌  service-account.json not found in scripts/ folder.")
        sys.exit(1)

    if not INPUT_FILE.exists():
        print(f"❌  {INPUT_FILE} not found. Run extract.py first.")
        sys.exit(1)

    with open(INPUT_FILE, encoding="utf-8") as f:
        questions = json.load(f)

    print(f"   Loaded {len(questions)} questions")

    # Group by (subject, chapter)
    chapter_map: dict[tuple, dict] = defaultdict(lambda: {
        "count": 0,
        "stream": "BOTH",
    })

    for q in questions:
        subject = q.get("subject", "General")
        chapter = q.get("chapter", "General")
        key = (subject, chapter)
        chapter_map[key]["count"] += 1
        chapter_map[key]["stream"] = q.get("stream", "BOTH")

    print(f"   Found {len(chapter_map)} unique chapters across all subjects")

    # Connect to Firestore
    print("   Connecting to Firestore ...", end=" ", flush=True)
    cred = credentials.Certificate(str(SERVICE_ACCOUNT))
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅\n")

    # Write in batches
    entries = list(chapter_map.items())
    batches = [entries[i:i + BATCH_SIZE] for i in range(0, len(entries), BATCH_SIZE)]
    imported = 0

    for i, batch_items in enumerate(batches):
        batch = db.batch()
        for (subject, chapter), data in batch_items:
            safe_id = f"{subject}_{chapter}".replace(" ", "_").replace("/", "-")[:100]
            ref = db.collection(COLLECTION).document(safe_id)
            batch.set(ref, {
                "subject":       subject,
                "chapter":       chapter,
                "stream":        data["stream"],
                "questionCount": data["count"],
            })
        batch.commit()
        imported += len(batch_items)
        print(f"   Batch {i + 1}/{len(batches)}: {imported} chapters written")

    # Summary by subject
    by_subject: dict[str, int] = defaultdict(int)
    for (subject, _) in chapter_map:
        by_subject[subject] += 1

    print(f"\n{'─' * 50}")
    print(f"✅  Done! {imported} chapters created in '{COLLECTION}/' collection.")
    for subj, count in sorted(by_subject.items()):
        print(f"    {subj:<15}: {count} chapters")
    print()


if __name__ == "__main__":
    main()
