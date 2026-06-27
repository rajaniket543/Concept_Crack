#!/usr/bin/env python3
"""
PrepMind / Concept Crack — Question Extraction Script
======================================================
Extracts MCQ questions from PDF and DOC files using Claude Vision API.
Saves progress after each file so you can stop and resume anytime.

Setup:
  pip install -r requirements.txt
  Copy .env.example → .env and fill in your ANTHROPIC_API_KEY

Folder structure expected:
  pdfs/
  ├── Physics/
  │   ├── 1_Introduction.pdf
  │   ├── 2_Measurement-1.pdf
  │   └── ...
  ├── Mathematics/
  │   └── 1_Complex_Number.pdf
  ├── Biology/
  │   ├── Mineral_Nutrition.pdf
  │   └── Reproduction_in_Organisms.pdf
  └── Chemistry/
      └── Basic_Concepts.pdf

Run:
  python extract.py
"""

import os
import json
import base64
import re
import sys
from pathlib import Path
from datetime import datetime

# ── Dependency check ──────────────────────────────────────────────────────────

try:
    import fitz  # PyMuPDF
except ImportError:
    print("❌  PyMuPDF not installed. Run:  pip install -r requirements.txt")
    sys.exit(1)

try:
    import anthropic
except ImportError:
    print("❌  anthropic not installed. Run:  pip install -r requirements.txt")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # .env loading optional — can set env var directly

# ── Config ────────────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
PDF_ROOT          = Path("pdfs")
OUTPUT_FILE       = Path("output/all_questions.json")
PROGRESS_DIR      = Path("progress")
MODEL             = "claude-opus-4-8"  # best vision accuracy
PAGE_ZOOM         = 2.0               # higher = clearer image, slower

SUBJECT_STREAM = {
    "Physics":     "JEE",
    "Chemistry":   "BOTH",
    "Mathematics": "JEE",
    "Biology":     "NEET",
}

# ── Extraction prompt ─────────────────────────────────────────────────────────

PROMPT_IMAGE = """You are extracting MCQ questions from a JEE/NEET exam question paper image.

Extract ALL complete MCQ questions visible on this page.

Return ONLY a valid JSON array — no explanation, no markdown fences, just raw JSON.

Format:
[
  {
    "question": "complete question text here",
    "options": {
      "A": "option A text",
      "B": "option B text",
      "C": "option C text",
      "D": "option D text"
    },
    "answer": "A",
    "topic": "sub-topic name"
  }
]

Rules:
- Extract EVERY complete question on this page
- If answer key is visible (e.g. [A], Ans: B, \\[C\\]), extract the answer letter
- If no answer is visible, set answer to null
- If a question is cut off at the page edge, skip it
- Write math expressions in plain text: x^2 + 3x + 2, not LaTeX
- topic should be 2-4 words (e.g. "Newton's Laws", "Mole Concept", "Mineral Nutrition")
- Return [] if there are no complete questions on this page
"""

PROMPT_TEXT = """You are extracting MCQ questions from a JEE/NEET exam question paper.

Below is the raw text content of a question paper. Extract ALL MCQ questions.

Return ONLY a valid JSON array — no explanation, no markdown fences, just raw JSON.

Format:
[
  {
    "question": "complete question text here",
    "options": {
      "A": "option A text",
      "B": "option B text",
      "C": "option C text",
      "D": "option D text"
    },
    "answer": "A",
    "topic": "sub-topic name"
  }
]

Rules:
- Extract every MCQ that has 4 options (A/B/C/D or 1/2/3/4)
- If answer key is present (e.g. [A], Ans: B, correct answer: C), extract it
- Convert numbered options (1/2/3/4) to (A/B/C/D)
- If no answer visible, set answer to null
- Skip subjective questions (no options)
- topic should be 2-4 words describing the sub-topic

Text content:
"""

# ── PDF helpers ───────────────────────────────────────────────────────────────

def page_to_base64(page) -> str:
    mat = fitz.Matrix(PAGE_ZOOM, PAGE_ZOOM)
    pix = page.get_pixmap(matrix=mat)
    return base64.standard_b64encode(pix.tobytes("png")).decode("utf-8")


def extract_json(text: str) -> list:
    """Parse a JSON array from Claude's response robustly."""
    text = text.strip()
    # Strip markdown code fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    # Direct parse
    try:
        result = json.loads(text)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        pass
    # Find JSON array within surrounding text
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            result = json.loads(match.group())
            return result if isinstance(result, list) else []
        except json.JSONDecodeError:
            pass
    return []


def infer_subject(path: Path) -> str:
    for part in path.parts:
        if part in SUBJECT_STREAM:
            return part
    return "General"


def infer_chapter(path: Path) -> str:
    name = path.stem
    name = re.sub(r'^\d+[_\-\s]', '', name)  # remove leading "1_" or "12-"
    return name.replace("-", " ").replace("_", " ").strip()


def progress_file(path: Path) -> Path:
    safe = re.sub(r'[^\w]', '_', path.stem)
    return PROGRESS_DIR / f"{safe}.json"


def load_progress(path: Path) -> list | None:
    pf = progress_file(path)
    if pf.exists():
        with open(pf, encoding="utf-8") as f:
            return json.load(f)
    return None


def save_progress(path: Path, questions: list):
    PROGRESS_DIR.mkdir(exist_ok=True)
    with open(progress_file(path), "w", encoding="utf-8") as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)


def tag_questions(questions: list, path: Path) -> list:
    """Attach subject/chapter/stream metadata to extracted questions."""
    subject = infer_subject(path)
    chapter = infer_chapter(path)
    stream  = SUBJECT_STREAM.get(subject, "BOTH")
    now     = datetime.utcnow().isoformat()
    for q in questions:
        q.setdefault("subject",   subject)
        q.setdefault("chapter",   chapter)
        q.setdefault("stream",    stream)
        q.setdefault("source",    "ALLEN")
        q.setdefault("isPYQ",     False)
        q.setdefault("difficulty","Medium")
        q.setdefault("createdAt", now)
    return questions

# ── Extraction: PDF via vision ────────────────────────────────────────────────

def extract_pdf(path: Path, client: anthropic.Anthropic) -> list:
    print(f"\n  📄  {path.name}")

    cached = load_progress(path)
    if cached is not None:
        print(f"      ✅  Already extracted ({len(cached)} questions) — skipping")
        return cached

    all_q = []
    try:
        doc = fitz.open(str(path))
    except Exception as e:
        print(f"      ❌  Cannot open: {e}")
        return []

    for i, page in enumerate(doc):
        print(f"      Page {i+1}/{len(doc)} ...", end=" ", flush=True)
        try:
            img_b64 = page_to_base64(page)
            resp = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
                        {"type": "text",  "text": PROMPT_IMAGE}
                    ]
                }]
            )
            questions = extract_json(resp.content[0].text)
            print(f"{len(questions)} found")
            all_q.extend(questions)
        except Exception as e:
            print(f"ERROR — {e}")

    doc.close()
    all_q = tag_questions(all_q, path)
    save_progress(path, all_q)
    print(f"      ✅  Done — {len(all_q)} questions total")
    return all_q


# ── Extraction: DOC via text ──────────────────────────────────────────────────

def extract_doc(path: Path, client: anthropic.Anthropic) -> list:
    print(f"\n  📝  {path.name}")

    cached = load_progress(path)
    if cached is not None:
        print(f"      ✅  Already extracted ({len(cached)} questions) — skipping")
        return cached

    try:
        import docx
        doc  = docx.Document(str(path))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except ImportError:
        print("      ❌  python-docx not installed. Run:  pip install python-docx")
        return []
    except Exception as e:
        print(f"      ❌  Cannot open DOC: {e}")
        return []

    if not text.strip():
        print("      ⚠️   No readable text in DOC file")
        return []

    print(f"      Sending {len(text)} characters to Claude ...", end=" ", flush=True)

    # Send in chunks of 15,000 chars to stay within token limits
    CHUNK = 15_000
    all_q = []
    chunks = [text[i:i+CHUNK] for i in range(0, len(text), CHUNK)]

    for idx, chunk in enumerate(chunks):
        if len(chunks) > 1:
            print(f"\n      Chunk {idx+1}/{len(chunks)} ...", end=" ", flush=True)
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": PROMPT_TEXT + chunk
                }]
            )
            questions = extract_json(resp.content[0].text)
            print(f"{len(questions)} found")
            all_q.extend(questions)
        except Exception as e:
            print(f"ERROR — {e}")

    all_q = tag_questions(all_q, path)
    save_progress(path, all_q)
    print(f"      ✅  Done — {len(all_q)} questions total")
    return all_q


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n🚀  PrepMind Question Extractor\n")

    if not ANTHROPIC_API_KEY:
        print("❌  ANTHROPIC_API_KEY not set.")
        print("    1. Copy .env.example → .env")
        print("    2. Add your key:  ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    OUTPUT_FILE.parent.mkdir(exist_ok=True)

    # Collect all PDF and DOC files
    pdfs = sorted(PDF_ROOT.rglob("*.pdf"))
    docs = sorted(PDF_ROOT.rglob("*.doc")) + sorted(PDF_ROOT.rglob("*.docx"))
    files = pdfs + docs

    if not files:
        print(f"❌  No files found in {PDF_ROOT}/")
        print("\n   Expected structure:")
        print("   pdfs/Physics/1_Introduction.pdf")
        print("   pdfs/Biology/Mineral_Nutrition.pdf")
        print("   pdfs/Chemistry/Basic_Concepts.pdf")
        print("   pdfs/Mathematics/1_Complex_Number.pdf")
        sys.exit(1)

    print(f"   Found {len(pdfs)} PDF(s) and {len(docs)} DOC(s)\n")

    # Check progress folder for already-done files
    done = len([f for f in files if load_progress(f) is not None])
    if done:
        print(f"   ⏭️   {done} file(s) already extracted — will skip those\n")

    all_questions = []
    stats: dict[str, int] = {}

    for f in files:
        if f.suffix.lower() == ".pdf":
            questions = extract_pdf(f, client)
        else:
            questions = extract_doc(f, client)

        all_questions.extend(questions)
        subj = infer_subject(f)
        stats[subj] = stats.get(subj, 0) + len(questions)

    # Write final output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(all_questions, out, indent=2, ensure_ascii=False)

    # Print summary
    print(f"\n{'─' * 50}")
    print(f"✅  Extraction complete!")
    print(f"    Total questions : {len(all_questions)}")
    for subj, count in sorted(stats.items()):
        print(f"    {subj:<15}: {count}")
    print(f"\n    Output → {OUTPUT_FILE}")
    print(f"\n    Next step:  python import_firestore.py")
    print()


if __name__ == "__main__":
    main()
