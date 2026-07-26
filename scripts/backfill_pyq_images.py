#!/usr/bin/env python3
"""
One-off backfill: the 25 PYQ questions extracted with a matched diagram image
were already imported to arcvion-test's Firestore (via import_firestore.py)
before we discovered arcvion-test has no Storage bucket (Spark plan, no
billing). Rather than re-import everything, this uploads just those 25 local
images to concept-crack's Storage (which already has Blaze/billing enabled)
and patches the matching existing question docs in arcvion-test's Firestore
with the resulting imageUrl.

Run:  python backfill_pyq_images.py
"""

import json
import sys
import uuid
import urllib.parse
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, storage

QUESTIONS_FILE = Path("output/pyq_questions.json")
ARCVION_KEY = Path("arcvion-test-firebase-adminsdk-fbsvc-feb627d384.json")
CONCEPT_CRACK_KEY = Path("service-account.json")
CONCEPT_CRACK_BUCKET = "concept-crack.firebasestorage.app"


def upload_to_concept_crack(bucket, local_path: str) -> str | None:
    p = Path(local_path)
    if not p.exists():
        print(f"      local file missing: {p}")
        return None
    ext = p.suffix.lstrip(".") or "png"
    dest = f"question-images/pyq-import/{uuid.uuid4()}.{ext}"
    blob = bucket.blob(dest)
    token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_filename(str(p))
    blob.patch()
    quoted = urllib.parse.quote(dest, safe="")
    return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quoted}?alt=media&token={token}"


def main():
    print("\nPYQ image backfill (concept-crack Storage -> arcvion-test Firestore)\n")

    questions = json.load(open(QUESTIONS_FILE, encoding="utf-8"))
    todo = [q for q in questions if q.get("imageLocalPath")]
    print(f"   {len(todo)} question(s) need an image backfilled")

    cc_cred = credentials.Certificate(str(CONCEPT_CRACK_KEY))
    cc_app = firebase_admin.initialize_app(cc_cred, {"storageBucket": CONCEPT_CRACK_BUCKET}, name="concept-crack")
    cc_bucket = storage.bucket(app=cc_app)

    av_cred = credentials.Certificate(str(ARCVION_KEY))
    av_app = firebase_admin.initialize_app(av_cred, name="arcvion-test")
    db = firestore.client(app=av_app)

    updated = 0
    not_found = 0
    upload_failed = 0

    for q in todo:
        matches = list(
            db.collection("questions")
            .where("question", "==", q["question"])
            .where("subject", "==", q["subject"])
            .where("chapter", "==", q["chapter"])
            .stream()
        )
        if len(matches) != 1:
            print(f"   ⚠️  {len(matches)} match(es) for: {q['question'][:60]!r} — skipping")
            not_found += 1
            continue

        try:
            url = upload_to_concept_crack(cc_bucket, q["imageLocalPath"])
        except Exception as e:
            print(f"   ⚠️  upload failed for {q['imageLocalPath']}: {e}")
            upload_failed += 1
            continue

        if not url:
            upload_failed += 1
            continue

        matches[0].reference.update({"imageUrl": url})
        updated += 1
        print(f"   ✅  {q['question'][:60]}")

    print(f"\n{'-' * 50}")
    print(f"Done! updated={updated}  not_found={not_found}  upload_failed={upload_failed}")


if __name__ == "__main__":
    main()
