#!/usr/bin/env python3
"""
PrepMind — Firestore Import Script
====================================
Reads output/all_questions.json and imports all questions into Firestore.
Skips already-imported questions using a checkpoint file.

Any question with a local "imageLocalPath" (set by extract.py's figure-matching)
is first uploaded to Firebase Storage; the field is replaced with a real
"imageUrl" before the document is written, so no local file path ever ends up
in Firestore.

Run:  python import_firestore.py
"""

import json
import os
import sys
import uuid
import urllib.parse
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
except ImportError:
    print("❌  Run:  pip install firebase-admin")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

SERVICE_ACCOUNT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("service-account.json")
INPUT_FILE      = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("output/all_questions.json")
BATCH_SIZE      = 499   # Firestore max is 500 per batch
COLLECTION      = "questions"
# Bucket follows the service-account key's project (new-project convention),
# so a different key targets a different project's Storage with no edit here.
# Override with FIREBASE_STORAGE_BUCKET for an older <project>.appspot.com bucket.
with open(SERVICE_ACCOUNT) as _f:
    _project = json.load(_f)["project_id"]
STORAGE_BUCKET  = os.environ.get("FIREBASE_STORAGE_BUCKET", f"{_project}.firebasestorage.app")

# ── Figure upload ─────────────────────────────────────────────────────────────

def upload_figure(bucket, local_path: str) -> str | None:
    """
    Upload a locally-extracted figure to Storage and return a download URL in
    the same shape the web app's Firebase SDK produces (…?alt=media&token=…),
    so it works exactly like a faculty-uploaded image. Returns None on failure
    (the caller just leaves imageUrl unset rather than aborting the import).
    """
    p = Path(local_path)
    if not p.exists():
        return None
    ext = p.suffix.lstrip(".") or "png"
    dest = f"question-images/pdf-import/{uuid.uuid4()}.{ext}"
    blob = bucket.blob(dest)
    token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    try:
        blob.upload_from_filename(str(p))
        blob.patch()
    except Exception as e:
        print(f"      ⚠️  Figure upload failed for {p.name}: {e}")
        return None
    quoted = urllib.parse.quote(dest, safe="")
    return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quoted}?alt=media&token={token}"

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

    # Connect to Firestore + Storage
    print("   Connecting to Firebase ...", end=" ", flush=True)
    cred = credentials.Certificate(str(SERVICE_ACCOUNT))
    firebase_admin.initialize_app(cred, {"storageBucket": STORAGE_BUCKET})
    db     = firestore.client()
    bucket = storage.bucket()
    print("✅\n")

    # Upload any locally-extracted figures and swap the local path for a real URL
    # before anything is written to Firestore.
    with_figures = [q for q in questions if q.get("imageLocalPath")]
    if with_figures:
        print(f"   Uploading {len(with_figures)} figure(s) to Storage ...")
        uploaded = 0
        for q in with_figures:
            url = upload_figure(bucket, q["imageLocalPath"])
            if url:
                q["imageUrl"] = url
                uploaded += 1
            q.pop("imageLocalPath", None)
        print(f"   ✅  {uploaded}/{len(with_figures)} figure(s) uploaded\n")

    # Same, but for per-option diagram images (questionType "single" MCQs where
    # some or all of A/B/C/D are drawn structures rather than text).
    with_option_figures = [q for q in questions if q.get("optionImageLocalPaths")]
    if with_option_figures:
        total_opt_images = sum(len(q["optionImageLocalPaths"]) for q in with_option_figures)
        print(f"   Uploading {total_opt_images} option figure(s) to Storage ...")
        uploaded = 0
        for q in with_option_figures:
            option_images = {}
            for letter, local_path in q["optionImageLocalPaths"].items():
                url = upload_figure(bucket, local_path)
                if url:
                    option_images[letter] = url
                    uploaded += 1
            if option_images:
                q["optionImages"] = option_images
            q.pop("optionImageLocalPaths", None)
        print(f"   ✅  {uploaded}/{total_opt_images} option figure(s) uploaded\n")

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
