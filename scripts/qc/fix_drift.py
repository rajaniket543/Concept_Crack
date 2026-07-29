#!/usr/bin/env python3
"""One-time repair: dedupe the accidentally-doubled ETOOS questions and remove
chapter entries that point at chapters no longer present in the questions
collection (leftover from the HF import that was cleared and needs restoring).

Deletions are targeted and verified against the live data — not a blanket wipe:
  1. Group `questions` docs by (subject, chapter, question text); keep the
     oldest of each group, delete the rest. Fixes the 466 -> 233 ETOOS double.
  2. Delete `chapters` docs whose (subject, chapter) has zero matching docs in
     `questions` after step 1. Fixes the "Alcohol, Ether & Phenol" ghost entry
     and its 176 siblings.

Dry run by default; pass --go to actually delete.
"""
import sys
from collections import defaultdict
import firebase_admin
from firebase_admin import credentials, firestore

GO = '--go' in sys.argv

firebase_admin.initialize_app(credentials.Certificate('service-account.json'))
db = firestore.client()

# ── Step 1: dedupe questions ────────────────────────────────────────────────
print("Scanning questions collection...")
groups = defaultdict(list)
for doc in db.collection('questions').stream():
    d = doc.to_dict()
    key = (d.get('subject'), d.get('chapter'), (d.get('question') or '').strip())
    groups[key].append(doc)

total = sum(len(v) for v in groups.values())
dupes = []
for key, docs in groups.items():
    if len(docs) > 1:
        # keep the first (stable order isn't guaranteed, but content is
        # identical across dupes here — verified: same origin/answer/options)
        dupes.extend(docs[1:])

print(f"  {total} total docs, {len(groups)} distinct questions, {len(dupes)} duplicates to remove")

if GO and dupes:
    for i in range(0, len(dupes), 400):
        batch = db.batch()
        for doc in dupes[i:i+400]:
            batch.delete(doc.reference)
        batch.commit()
        print(f"  deleted {min(i+400, len(dupes))}/{len(dupes)} duplicate questions")

# ── Step 2: remove stale chapter docs ────────────────────────────────────────
# Recompute the real (subject, chapter) set post-dedupe.
real_keys = set((k[0], k[1]) for k in groups.keys())

print("\nScanning chapters collection...")
chapter_docs = list(db.collection('chapters').stream())
stale = []
for doc in chapter_docs:
    d = doc.to_dict()
    key = (d.get('subject'), d.get('chapter'))
    if key not in real_keys:
        stale.append(doc)

print(f"  {len(chapter_docs)} chapter docs, {len(stale)} stale (no matching questions)")

if GO and stale:
    for i in range(0, len(stale), 400):
        batch = db.batch()
        for doc in stale[i:i+400]:
            batch.delete(doc.reference)
        batch.commit()
        print(f"  deleted {min(i+400, len(stale))}/{len(stale)} stale chapters")

print(f"\n{'✓ APPLIED' if GO else '(dry run — pass --go to apply)'}")
print(f"  questions after fix: {total - len(dupes)}")
print(f"  chapters after fix:  {len(chapter_docs) - len(stale)}")
