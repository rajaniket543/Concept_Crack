#!/usr/bin/env python3
"""
One-off: assembles the combined "JEE Main 2024 (April 9 Shift 2)" paper from
three sources into a single reference-shaped bundle.json (final blocks shape,
same as import_pyq_paper.py already consumes for the 2020 paper):
  1. Physics + Chemistry questions already cleanly extracted by extract_pyq.py
     (output/pyq_questions.json, chapter == "JEE Main 2024 PYQ")
  2. The one Physics question that needed manual resolution (circuit diagram +
     truth table are BOTH legitimate sequential images, not "ambiguous")
  3. The ten Maths questions transcribed by hand from the rendered pages
     (output/manual_2024/maths_bundle.json) — extract_pyq.py silently dropped
     most of this file because its formulas have no text layer at all.

Order: Physics -> Chemistry -> Mathematics, matching the real exam's section
order, with questionNo renumbered 1..N across the whole combined paper.
"""

import json
import shutil
from pathlib import Path

OUT_DIR = Path("output/manual_2024")
IMAGES_DIR = OUT_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

PAPER = {"exam": "JEE Main", "year": 2024, "shift": "2024 April 9 Shift 2"}

img_counter = [0]


def copy_image(local_path: str, prefix: str) -> str:
    src = Path(local_path)
    img_counter[0] += 1
    dest_name = f"{prefix}_{img_counter[0]}{src.suffix}"
    shutil.copy(src, IMAGES_DIR / dest_name)
    return f"images/{dest_name}"


def convert_flat_question(q: dict) -> dict:
    """Converts one already-extracted flat question (from pyq_questions.json)
    into the final blocks shape."""
    blocks = [{"type": "text", "content": q["question"]}]
    if q.get("imageLocalPath"):
        blocks.append({"type": "image", "path": copy_image(q["imageLocalPath"], q["subject"].lower())})

    if q["questionType"] == "numeric":
        answer = {"type": "NAT", "correctValue": q["answer"]}
    else:
        opts = q["options"]
        opt_images = q.get("optionImageLocalPaths", {})
        values = []
        for letter in "ABCD":
            if opt_images.get(letter):
                values.append({"type": "image", "path": copy_image(opt_images[letter], f"{q['subject'].lower()}_opt")})
            else:
                values.append({"type": "text", "content": opts.get(letter, "")})
        blocks.append({"type": "options", "values": values})
        answer = {"type": "MCQ", "correctOption": q["answer"], "correctIndex": "ABCD".index(q["answer"])}

    return {"subject": q["subject"].lower(), "blocks": blocks, "answer": answer}


def text_options_block(strings: list) -> dict:
    return {"type": "options", "values": [{"type": "text", "content": s} for s in strings]}


def main():
    combined = []

    # 1. Physics + Chemistry, already clean
    all_qs = json.loads(Path("output/pyq_questions.json").read_text(encoding="utf-8"))
    for subj in ["Physics", "Chemistry"]:
        for q in all_qs:
            if q["subject"] == subj and q["chapter"] == "JEE Main 2024 PYQ":
                combined.append(convert_flat_question(q))

    physics_count = sum(1 for e in combined if e["subject"] == "physics")
    chem_count = sum(1 for e in combined if e["subject"] == "chemistry")
    print(f"Physics (auto-extracted): {physics_count}, Chemistry: {chem_count}")

    # 2. The one manually-resolved Physics question (circuit + truth table)
    circuit = "output/review_assets_pyq/JEE_Main_2024__April_9_Shift_2__Physics_Question_Paper_with_Solutions__PDF_/2024_JEEMain2024April9Shift2PhysicsQuestionPaperwithSolutionsPDF_q1_cand0_p4_x31.png"
    table = "output/review_assets_pyq/JEE_Main_2024__April_9_Shift_2__Physics_Question_Paper_with_Solutions__PDF_/2024_JEEMain2024April9Shift2PhysicsQuestionPaperwithSolutionsPDF_q1_cand1_p4_x33.png"
    combined.insert(physics_count, {
        "subject": "physics",
        "blocks": [
            {"type": "text", "content": "For the circuit shown, the truth table is given. Find x and y."},
            {"type": "image", "path": copy_image(circuit, "physics_extra")},
            {"type": "image", "path": copy_image(table, "physics_extra")},
            text_options_block(["0, 0", "0, 1", "1, 0", "1, 1"]),
        ],
        "answer": {"type": "MCQ", "correctOption": "D", "correctIndex": 3},
    })

    # 3. Maths, hand-transcribed
    maths = json.loads(Path("output/manual_2024/maths_bundle.json").read_text(encoding="utf-8"))
    for q in maths:
        blocks = list(q["blocks"])
        # copy the one referenced image (the variance table) into the shared images dir
        for b in blocks:
            if b["type"] == "image":
                b["path"] = copy_image(str(OUT_DIR / b["path"]), "maths")
        if "options" in q:
            blocks.append(text_options_block(q["options"]))
        combined.append({"subject": "mathematics", "blocks": blocks, "answer": q["answer"]})
    print(f"Mathematics (hand-transcribed): {len(maths)}")

    # Renumber + tag paper metadata
    bundle = []
    for i, entry in enumerate(combined, 1):
        bundle.append({
            "id": f"jee-main-2024-apr09-s2-q{i:03d}",
            "exam": PAPER["exam"], "year": PAPER["year"], "shift": PAPER["shift"],
            "subject": entry["subject"], "questionNo": i,
            "type": entry["answer"]["type"],
            "blocks": entry["blocks"],
            "answer": entry["answer"],
        })

    out_file = OUT_DIR / "bundle.json"
    out_file.write_text(json.dumps(bundle, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {len(bundle)} questions to {out_file}")
    print(f"Images copied to {IMAGES_DIR} ({img_counter[0]} files)")


if __name__ == "__main__":
    main()
