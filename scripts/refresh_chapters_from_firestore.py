#!/usr/bin/env python3
"""
Recomputes chapters/ questionCount directly from what's actually live in
questions/, rather than from a local JSON snapshot (which drifts once
questions get added out-of-band, e.g. via apply_review_decisions.py writing
straight to Firestore).

Run:  python refresh_chapters_from_firestore.py <service-account.json>
"""

import sys
from collections import defaultdict
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("service-account.json")


def main():
    cred = credentials.Certificate(str(SERVICE_ACCOUNT))
    app = firebase_admin.initialize_app(cred)
    db = firestore.client(app=app)

    # Paginate the scan — a single unbounded stream() times out once the
    # collection grows large (14k+ docs), so page through in chunks instead.
    docs = []
    PAGE_SIZE = 1000
    query = db.collection("questions").order_by("__name__").limit(PAGE_SIZE)
    last = None
    while True:
        q = query.start_after(last) if last is not None else query
        page = list(q.stream())
        if not page:
            break
        docs.extend(page)
        last = page[-1]
        print(f"   ...scanned {len(docs)} so far")
        if len(page) < PAGE_SIZE:
            break
    print(f"Loaded {len(docs)} question docs")

    chapter_map: dict[tuple, dict] = defaultdict(lambda: {"count": 0, "stream": "BOTH"})
    for d in docs:
        data = d.to_dict()
        subject = data.get("subject", "General")
        chapter = data.get("chapter", "General")
        key = (subject, chapter)
        chapter_map[key]["count"] += 1
        chapter_map[key]["stream"] = data.get("stream", "BOTH")

    print(f"Found {len(chapter_map)} unique chapters")

    entries = list(chapter_map.items())
    BATCH_SIZE = 499  # Firestore max is 500 writes per batch
    for i in range(0, len(entries), BATCH_SIZE):
        batch = db.batch()
        for (subject, chapter), info in entries[i:i + BATCH_SIZE]:
            safe_id = f"{subject}_{chapter}".replace(" ", "_").replace("/", "-")[:100]
            ref = db.collection("chapters").document(safe_id)
            batch.set(ref, {
                "subject": subject,
                "chapter": chapter,
                "stream": info["stream"],
                "questionCount": info["count"],
            })
        batch.commit()

    print(f"\nUpdated {len(chapter_map)} chapter doc(s):")
    for (subject, chapter), info in sorted(chapter_map.items()):
        print(f"    {subject:<12} {chapter:<25}: {info['count']}")


if __name__ == "__main__":
    main()
