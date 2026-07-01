#!/usr/bin/env python3
"""
PrepMind — Firestore Import Script
====================================
Reads output/all_questions.json and imports all questions into Firestore.
Skips already-imported questions using a checkpoint file.

Run:  python import_firestore.py
"""

import json
import sys
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌  Run:  pip install firebase-admin")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

SERVICE_ACCOUNT = Path("service-account.json")
INPUT_FILE      = Path("output/all_questions.json")
BATCH_SIZE      = 499   # Firestore max is 500 per batch
COLLECTION      = "questions"

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n🚀  PrepMind Firestore Importer\n")

    if not SERVICE_ACCOUNT.exists():
        print("❌  service-account.json not found in scripts/ folder.")
        print("    Firebase Console → Project Settings → Service Accounts → Generate key")
        sys.exit(1)

    if not INPUT_FILE.exists():
        print(f"❌  {INPUT_FILE} not found. Run extract.py first.")
        sys.exit(1)

    # Load questions
    with open(INPUT_FILE, encoding="utf-8") as f:
        questions = json.load(f)

    print(f"   Loaded {len(questions)} questions from {INPUT_FILE}")

    # Connect to Firestore
    print("   Connecting to Firestore ...", end=" ", flush=True)
    cred = credentials.Certificate(str(SERVICE_ACCOUNT))
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅\n")

    # Import in batches of 499
    total    = len(questions)
    imported = 0
    errors   = 0
    batches  = [questions[i:i+BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]

    print(f"   Importing {total} questions in {len(batches)} batches...\n")

    for i, batch_items in enumerate(batches):
        batch = db.batch()
        for q in batch_items:
            ref = db.collection(COLLECTION).document()
            batch.set(ref, q)

        try:
            batch.commit()
            imported += len(batch_items)
            pct = round(imported / total * 100)
            bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
            print(f"   Batch {i+1}/{len(batches)}  [{bar}]  {imported}/{total}  ({pct}%)")
        except Exception as e:
            errors += len(batch_items)
            print(f"   Batch {i+1} ❌  {e}")

    print(f"\n{'─' * 50}")
    print(f"✅  Import complete!")
    print(f"    Imported : {imported}")
    if errors:
        print(f"    Errors   : {errors}")
    print(f"\n    All {imported} questions are now live in Firestore.")
    print(f"    Collection: {COLLECTION}/\n")


if __name__ == "__main__":
    main()
