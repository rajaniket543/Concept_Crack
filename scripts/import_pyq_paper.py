#!/usr/bin/env python3
"""
Imports one fully-transcribed PYQ paper (blocks-format bundle.json, matching
the ConceptCrack reference schema) into concept-crack: uploads every image to
Storage, converts each question into our Firestore shape (bodyBlocks + flat
options/optionImages/prompt fallback), and creates one `tests/` doc of
type "pyq" referencing all questions in original exam order — so the whole
paper plays as a single mixed-subject test via the existing exam player.

Run:
  python import_pyq_paper.py --bundle <bundle.json> --images-root <dir> \
      --title "JEE Main 2020 — January 7 Shift 1" --paper-id jee-main-2020-jan07-s1 \
      --service-account service-account.json
"""

import argparse
import json
import re
import sys
import uuid
import urllib.parse
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, storage

DURATION_SECONDS = 180 * 60  # standard JEE Main paper length


def upload_image(bucket, local_path: Path, cache: dict) -> str | None:
    key = str(local_path)
    if key in cache:
        return cache[key]
    if not local_path.exists():
        print(f"      missing image file: {local_path}")
        return None
    ext = local_path.suffix.lstrip(".") or "png"
    dest = f"question-images/pyq-papers/{uuid.uuid4()}.{ext}"
    blob = bucket.blob(dest)
    token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_filename(str(local_path))
    blob.patch()
    quoted = urllib.parse.quote(dest, safe="")
    url = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quoted}?alt=media&token={token}"
    cache[key] = url
    return url


def answer_letter_or_value(answer: dict) -> tuple[str, str]:
    """Returns (questionType, answer). MCQ -> ('single', 'A'..'D'). NAT -> ('numeric', value)."""
    if answer["type"] == "MCQ":
        return "single", answer["correctOption"]
    return "numeric", str(answer["correctValue"])


def convert_question(q: dict, images_root: Path, bucket, cache: dict, paper_meta: dict) -> dict | None:
    body_blocks = []
    options_block = None
    for b in q["blocks"]:
        if b["type"] == "text":
            if b["content"].strip():
                body_blocks.append({"type": "text", "content": b["content"]})
        elif b["type"] == "image":
            url = upload_image(bucket, images_root / b["path"], cache)
            if url:
                body_blocks.append({"type": "image", "imageUrl": url})
        elif b["type"] == "options":
            options_block = b["values"]

    if not body_blocks:
        return None

    question_type, answer = answer_letter_or_value(q["answer"])

    options = {"A": "", "B": "", "C": "", "D": ""}
    option_images = {}
    if options_block:
        for letter, val in zip("ABCD", options_block):
            if val["type"] == "text":
                options[letter] = val["content"]
            else:
                url = upload_image(bucket, images_root / val["path"], cache)
                if url:
                    option_images[letter] = url

    # Flat fallbacks for surfaces that don't know about bodyBlocks yet
    # (search, faculty review lists, etc.) — concatenate text, first image only.
    flat_text = " ".join(b["content"] for b in body_blocks if b["type"] == "text").strip()
    flat_image = next((b["imageUrl"] for b in body_blocks if b["type"] == "image"), None)

    doc = {
        "question": flat_text,
        "bodyBlocks": body_blocks,
        "options": options,
        "answer": answer,
        "questionType": question_type,
        "subject": q["subject"].capitalize(),
        "chapter": paper_meta["chapter"],
        "topic": paper_meta["shift"],
        "stream": "JEE",
        "source": "JEE Main PYQ",
        "isPYQ": True,
        "difficulty": "Medium",
        "createdAt": paper_meta["now"],
    }
    if flat_image:
        doc["imageUrl"] = flat_image
    if option_images:
        doc["optionImages"] = option_images
    return doc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", required=True)
    ap.add_argument("--images-root", required=True, help="dir that bundle image paths are relative to")
    ap.add_argument("--title", required=True)
    ap.add_argument("--paper-id", required=True, help="used as the tests/ doc id and question id prefix")
    ap.add_argument("--service-account", default="service-account.json")
    args = ap.parse_args()

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
    images_root = Path(args.images_root)
    print(f"Loaded {len(bundle)} questions from {args.bundle}")

    cred = credentials.Certificate(args.service_account)
    with open(args.service_account) as f:
        project = json.load(f)["project_id"]
    app = firebase_admin.initialize_app(cred, {"storageBucket": f"{project}.firebasestorage.app"})
    db = firestore.client(app=app)
    bucket = storage.bucket(app=app)

    shift = bundle[0].get("shift", "")
    year = bundle[0].get("year", "")
    paper_meta = {"chapter": f"JEE Main {year} PYQ", "shift": shift, "now": now}

    cache = {}
    question_ids = []
    subjects_seen = []
    written = 0
    skipped = 0

    for q in sorted(bundle, key=lambda x: x["questionNo"]):
        doc = convert_question(q, images_root, bucket, cache, paper_meta)
        if not doc:
            skipped += 1
            print(f"   skip Q{q['questionNo']}: no usable content")
            continue
        qid = f"{args.paper_id}-q{q['questionNo']:03d}"
        db.collection("questions").document(qid).set(doc)
        question_ids.append(qid)
        if doc["subject"] not in subjects_seen:
            subjects_seen.append(doc["subject"])
        written += 1
        if written % 10 == 0:
            print(f"   {written}/{len(bundle)} questions written...")

    test_doc = {
        "type": "pyq",
        "status": "active",
        "title": args.title,
        "createdBy": "system",
        "stream": "JEE",
        "subjects": subjects_seen,
        "chapters": [],
        "difficulty": "Mixed",
        "questionCount": len(question_ids),
        "durationSeconds": DURATION_SECONDS,
        "startAt": None,
        "endAt": None,
        "instructions": "Full previous-year paper, exactly as it appeared in the original exam.",
        "negativeMarking": True,
        "assignedTo": "all",
        "questionIds": question_ids,
        "createdAt": now,
        "updatedAt": now,
    }
    db.collection("tests").document(args.paper_id).set(test_doc)

    print(f"\n{'-' * 50}")
    print(f"Done! {written} questions written, {skipped} skipped")
    print(f"images uploaded (unique): {len(cache)}")
    print(f"test doc: tests/{args.paper_id}  ({len(question_ids)} questions, subjects: {subjects_seen})")


if __name__ == "__main__":
    main()
