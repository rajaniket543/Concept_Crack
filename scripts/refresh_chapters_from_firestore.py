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

    docs = list(db.collection("questions").stream())
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

    batch = db.batch()
    for (subject, chapter), info in chapter_map.items():
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
