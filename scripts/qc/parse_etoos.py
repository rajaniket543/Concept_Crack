#!/usr/bin/env python3
"""Parse ETOOSINDIA chapter-module PDFs into the app's question schema.

These modules are laid out as: Theory → Exercise-1..4 → Answer Key. Questions
are coded per section (A-1, B-3, C-10, with a trailing * for multi-correct) and
the answers live in a separate Answer Key section grouped by EXERCISE. This
script pulls both and joins them by (exercise, code).

    python parse_etoos.py <file.pdf> [--subject Chemistry] [--chapter "..."]

Prints a yield report and a few samples. Writing to all_questions.json is a
second step once the yield looks right.
"""
import re
import sys
import json
from pathlib import Path
from pypdf import PdfReader

# A question header: "B-3.", "A-1*.", "C-10." at the start of a line.
Q_HEAD = re.compile(r'(?m)^\s*([A-Z])-(\d+)(\*?)\s*\.')
# An answer-key entry: "B-3. (C)" / "A-1*. (CD)".
ANS = re.compile(r'([A-Z])-(\d+)(\*?)\s*\.?\s*\(([A-D]+)\)')
# Options inside a question body.
OPT = re.compile(r'\(([A-D])\)\s*(.*?)(?=\(([A-D])\)|$)', re.S)
EXERCISE = re.compile(r'EXERCISE\s*-?\s*(\d+)', re.I)
ANSWER_KEY = re.compile(r'ANSWER\s*KEY', re.I)
FOOTER = re.compile(r'ETOOSINDIA|India.s No\.1|HelpDesk|Rajeev Gandhi Nagar|# ?\d+\s*$', re.I)


def clean(s: str) -> str:
    lines = [l for l in s.splitlines() if not FOOTER.search(l)]
    return re.sub(r'[ \t]+', ' ', '\n'.join(lines)).strip()


def exercise_at(pos: int, ex_marks: list) -> int:
    """Which EXERCISE number is in effect at a character offset."""
    ex = 1
    for p, n in ex_marks:
        if p <= pos:
            ex = n
        else:
            break
    return ex


def parse(pdf_path: str, subject: str, chapter: str):
    reader = PdfReader(pdf_path)
    pages = [p.extract_text() or '' for p in reader.pages]

    # Answer-key pages are the ones dense with "code. (letters)" entries — the
    # literal "ANSWER KEY" header isn't reliably present, but the density is.
    ans_page = [len(ANS.findall(t)) >= 6 for t in pages]
    q_text = clean('\n'.join(t for i, t in enumerate(pages) if not ans_page[i]))
    k_text = clean('\n'.join(t for i, t in enumerate(pages) if ans_page[i]))

    # Answer key → {code: letters}. Within one chapter module the codes are
    # globally unique (verified — no duplicates, no cross-exercise conflicts),
    # so matching by code alone is unambiguous and far more robust than trying
    # to reconstruct the fragile EXERCISE/PART structure from flattened text.
    answers = {}
    for a in ANS.finditer(k_text):
        sec, num, _star, letters = a.groups()
        answers[f'{sec}-{num}'] = letters

    heads = list(Q_HEAD.finditer(q_text))
    questions, seen = [], set()
    for idx, h in enumerate(heads):
        sec, num, star = h.group(1), h.group(2), h.group(3)
        start = h.end()
        end = heads[idx + 1].start() if idx + 1 < len(heads) else len(q_text)
        body = q_text[start:end]

        a_pos = body.find('(A)')
        if a_pos == -1:
            continue  # subjective / no options — skip for now
        stem = body[:a_pos].strip()
        opts = {}
        for om in OPT.finditer(body[a_pos:]):
            opts[om.group(1)] = re.sub(r'\s+', ' ', om.group(2)).strip().rstrip('.').strip()
        if len(opts) < 4 or not stem or len(stem) < 8:
            continue

        code = f'{sec}-{num}'
        if code in seen:
            continue  # a code should appear once; a repeat is a parse artifact
        seen.add(code)
        questions.append({
            'code': code, 'multi': bool(star),
            'stem': stem, 'options': opts, 'answer': answers.get(code),
        })

    return questions, answers


def chapter_from(pdf: str) -> str:
    stem = Path(pdf).stem
    return stem.split('12th-')[-1].replace('-', ' ').strip() if '12th-' in stem else stem


def to_docs(qs, subject, chapter):
    """Matched questions → the app's Firestore schema."""
    docs = []
    for q in qs:
        if not q['answer']:
            continue
        letters = q['answer']
        multi = q['multi'] or len(letters) > 1
        # A multi-correct key like "CD" isn't a single A/B/C/D — store the first
        # as answer and the full set separately; questionType marks it.
        docs.append({
            'question':   q['stem'],
            'options':    {k: q['options'].get(k, '') for k in 'ABCD'},
            'answer':     letters if not multi else letters[0],
            **({'correctOptions': list(letters)} if multi else {}),
            'questionType': 'multiple' if multi else 'single',
            'subject':    subject,
            'chapter':    chapter,
            'stream':     'JEE',
            'origin':     'ETOOS JEE Module',
            'source':     'ETOOS JEE Module',
            'difficulty': 'Medium',
            'isPYQ':      True,
            'createdAt':  __import__('datetime').datetime.utcnow().isoformat(),
        })
    return docs


def main():
    args = sys.argv[1:]
    write = '--write' in args
    files = [a for a in args if a.endswith('.pdf')]
    if not files:
        files = sorted(str(p) for p in Path('scripts/pdfs/pyq').glob('*.pdf'))

    all_docs, grand = [], {'blocks': 0, 'matched': 0, 'single': 0, 'multi': 0}
    for pdf in files:
        chapter = chapter_from(pdf)
        qs, answers = parse(pdf, 'Chemistry', chapter)
        # scanned files yield ~nothing — skip and flag
        if len(answers) == 0 and len(qs) < 3:
            print(f'  ⚠ {Path(pdf).name[:50]}: no text (scanned — needs OCR), skipped')
            continue
        docs = to_docs(qs, 'Chemistry', chapter)
        matched = [q for q in qs if q['answer']]
        multi = sum(1 for d in docs if d['questionType'] == 'multiple')
        grand['blocks'] += len(qs); grand['matched'] += len(matched)
        grand['single'] += len(docs) - multi; grand['multi'] += multi
        all_docs += docs
        print(f'  {len(docs):>4} kept  ({len(matched)}/{len(qs)} matched, {multi} multi)  {chapter}')

    print(f'\n═══ {len(all_docs)} questions from {len(files)} files ═══')
    print(f'   {grand["single"]} single-correct · {grand["multi"]} multi-correct · '
          f'{grand["blocks"]-grand["matched"]} unmatched dropped')

    if write:
        # Overwrite with ONLY the newly-parsed docs. import_firestore.py has no
        # dedup — it creates a new document per row — so the file must contain
        # only questions not already in Firestore, or the existing bank doubles.
        out = Path('scripts/output/all_questions.json')
        out.write_text(json.dumps(all_docs, ensure_ascii=False, indent=2))
        print(f'\n✓ wrote {len(all_docs)} questions → {out} (import adds these to the existing bank)')
    else:
        print('\n(dry run — pass --write to append to output/all_questions.json)')
        for q in [d for d in all_docs][:2]:
            print(f"\n[{q['subject']} · {q['chapter']}]  ans={q['answer']}  ({q['questionType']})")
            print(' ', q['question'][:110])
            for k in 'ABCD': print(f'    ({k}) {q["options"].get(k,"")[:70]}')


if __name__ == '__main__':
    main()
