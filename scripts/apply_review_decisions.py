#!/usr/bin/env python3
"""
Reads the decisions JSON downloaded from output/pyq_reviewer.html and imports
the resolved questions: uploads the chosen image to concept-crack's Storage
(the only project with billing/Storage enabled) and creates the question doc
directly in arcvion-test's Firestore. Skipped/undecided questions are left out
entirely — nothing is imported for them.

Run:  python apply_review_decisions.py path/to/pyq_review_decisions.json [target-service-account.json]
Target defaults to arcvion-test; pass service-account.json to target concept-crack instead.
"""

import base64
import json
import sys
import uuid
import urllib.parse
from datetime import datetime
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, storage

REVIEW_FILE = Path("output/pyq_needs_image_review.json")
ARCVION_KEY = Path("arcvion-test-firebase-adminsdk-fbsvc-feb627d384.json")
CONCEPT_CRACK_KEY = Path("service-account.json")
CONCEPT_CRACK_BUCKET = "concept-crack.firebasestorage.app"

# Mirrors extract_pyq.py's FILES_META year mapping, needed to reconstruct the
# same chapter/topic tagging the original import used.
FILE_YEAR_SHIFT = {
    "JEE Main 2024 (April 9 Shift 2) Maths Question Paper with Solutions [PDF].pdf": (2024, "April 9 Shift 2"),
    "JEE Main 2024 (April 9 Shift 2) Chemistry Question Paper with Solutions [PDF].pdf": (2024, "April 9 Shift 2"),
    "JEE Main 2024 (April 9 Shift 2) Physics Question Paper with Solutions [PDF].pdf": (2024, "April 9 Shift 2"),
    "JEE Main 2025 April 2 Shift 1 Question Paper and Solutions PDF _ Vedantu.pdf": (2025, "April 2 Shift 1"),
    "JEE Main 2026 April 8 Shift 2 Question Paper with Answer Key, Solutions PDF, and Analysis.pdf": (2026, "April 8 Shift 2"),
}


def upload_data_uri(bucket, data_uri: str) -> str:
    header, b64data = data_uri.split(",", 1)
    ext = "png"
    if "image/" in header:
        ext = header.split("image/")[1].split(";")[0]
    raw = base64.b64decode(b64data)
    dest = f"question-images/pyq-review/{uuid.uuid4()}.{ext}"
    blob = bucket.blob(dest)
    token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(raw, content_type=f"image/{ext}")
    blob.patch()
    quoted = urllib.parse.quote(dest, safe="")
    return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quoted}?alt=media&token={token}"


def main():
    if len(sys.argv) < 2:
        print("Usage: python apply_review_decisions.py path/to/pyq_review_decisions.json")
        sys.exit(1)

    decisions = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    review = {r["id"]: r for r in json.loads(REVIEW_FILE.read_text(encoding="utf-8"))}

    to_import = {id_: d for id_, d in decisions.items() if d.get("chosen") and not d.get("skipped")}
    print(f"{len(decisions)} decision(s) recorded, {len(to_import)} have an image chosen and will be imported")

    target_key = Path(sys.argv[2]) if len(sys.argv) > 2 else ARCVION_KEY

    cc_cred = credentials.Certificate(str(CONCEPT_CRACK_KEY))
    cc_app = firebase_admin.initialize_app(cc_cred, {"storageBucket": CONCEPT_CRACK_BUCKET}, name="storage-app")
    cc_bucket = storage.bucket(app=cc_app)

    target_cred = credentials.Certificate(str(target_key))
    target_app = firebase_admin.initialize_app(target_cred, name="target-app")
    db = firestore.client(app=target_app)

    imported = 0
    failed = 0
    now = datetime.utcnow().isoformat()

    for id_, decision in to_import.items():
        r = review.get(id_)
        if not r:
            print(f"   ⚠️  {id_}: not found in review file, skipping")
            failed += 1
            continue

        year, shift = FILE_YEAR_SHIFT.get(r["file"], (None, None))
        if year is None:
            print(f"   ⚠️  {id_}: unrecognised source file {r['file']!r}, skipping")
            failed += 1
            continue

        try:
            image_url = upload_data_uri(cc_bucket, decision["chosen"])
        except Exception as e:
            print(f"   ⚠️  {id_}: image upload failed: {e}")
            failed += 1
            continue

        if r.get("options"):
            # "ambiguous" case — text options/answer were already known, only the
            # image was in question.
            doc = {
                "question": r["question"],
                "options": r["options"],
                "answer": r["answer"],
                "questionType": r.get("questionType", "single"),
            }
        else:
            # "unusable options" case — options are the diagram itself. The
            # answer letter is known; option text is a placeholder pointing at
            # the attached figure.
            doc = {
                "question": r["question"],
                "options": {k: "See figure" for k in "ABCD"},
                "answer": r["answer"],
                "questionType": "single",
            }

        doc.update({
            "subject": r["subject"],
            "chapter": f"JEE Main {year} PYQ",
            "topic": shift,
            "stream": "JEE",
            "source": "JEE Main PYQ",
            "isPYQ": True,
            "difficulty": "Medium",
            "imageUrl": image_url,
            "createdAt": now,
        })

        db.collection("questions").document().set(doc)
        imported += 1
        print(f"   ✅  {r['question'][:60]}")

    print(f"\n{'-' * 50}")
    print(f"Done! imported={imported} failed={failed} "
          f"skipped_or_undecided={len(decisions) - len(to_import)}")


if __name__ == "__main__":
    main()
