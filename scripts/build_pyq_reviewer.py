#!/usr/bin/env python3
"""
Builds a self-contained local HTML tool for reviewing the 54 PYQ questions
that extract_pyq.py couldn't confidently attach an image to (either 2+
candidate images for one question, or options that are diagrams/structures
with no text to show). For each question it shows the question text, known
answer, full-page render(s) for context, and every candidate image found —
click one to pick it, or mark "skip". A "Download decisions" button produces
a JSON file that apply_review_decisions.py then uses to actually import the
resolved questions into arcvion-test.

Run:  python build_pyq_reviewer.py
Then: open output/pyq_reviewer.html in a browser.
"""

import base64
import json
import html
from pathlib import Path

REVIEW_FILE = Path("output/pyq_needs_image_review.json")
OUTPUT_FILE = Path("output/pyq_reviewer.html")


def to_data_uri(path: str) -> str:
    p = Path(path)
    ext = p.suffix.lstrip(".").lower()
    mime = "image/png" if ext == "png" else f"image/{ext}"
    data = base64.b64encode(p.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def main():
    review = json.loads(REVIEW_FILE.read_text(encoding="utf-8"))
    print(f"Embedding images for {len(review)} questions...")

    items = []
    for r in review:
        items.append({
            "id": r["id"],
            "question": r["question"],
            "subject": r.get("subject") or "(unknown)",
            "file": r["file"],
            "reason": r["reason"],
            "answer": r.get("answer"),
            "options": r.get("options"),
            "candidates": [to_data_uri(p) for p in r.get("candidateImagePaths", [])],
            "pages": [to_data_uri(p) for p in r.get("pageRenderPaths", [])],
        })

    data_json = json.dumps(items, ensure_ascii=False)

    html_doc = """<!doctype html>
<html><head><meta charset="utf-8"><title>PYQ Image Reviewer</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1a1a1e; color: #e8e8ec; margin: 0; }
  header { position: sticky; top: 0; background: #232329; padding: 14px 20px; border-bottom: 1px solid #3a3a42; z-index: 10; display: flex; justify-content: space-between; align-items: center; }
  header h1 { font-size: 16px; margin: 0; }
  #progress { font-size: 14px; color: #9a9aa5; }
  button.primary { background: #5B4FE8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
  button.primary:hover { background: #4a3fd0; }
  main { max-width: 1100px; margin: 0 auto; padding: 20px; }
  .card { background: #232329; border: 1px solid #3a3a42; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .card.decided { border-color: #3fa34d; }
  .card.skipped { opacity: 0.55; }
  .meta { font-size: 12px; color: #9a9aa5; margin-bottom: 8px; }
  .badge { display: inline-block; background: #3a3a42; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-right: 6px; }
  .qtext { font-size: 15px; margin: 8px 0 12px; line-height: 1.4; }
  .answer { font-size: 13px; color: #b8e6c1; margin-bottom: 10px; }
  .opts { font-size: 13px; color: #cfcfd6; margin-bottom: 10px; }
  .section-label { font-size: 11px; text-transform: uppercase; color: #7a7a85; margin: 10px 0 6px; letter-spacing: 0.5px; }
  .imgs { display: flex; flex-wrap: wrap; gap: 10px; }
  .imgs img { max-height: 220px; max-width: 320px; border: 3px solid transparent; border-radius: 6px; cursor: pointer; background: white; }
  .imgs img.selected { border-color: #5B4FE8; }
  .pagerow img { max-height: 320px; max-width: 100%; border-radius: 6px; border: 1px solid #3a3a42; }
  .actions { margin-top: 12px; display: flex; gap: 8px; }
  button.skip { background: transparent; border: 1px solid #6a6a75; color: #cfcfd6; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  button.skip.active { background: #6a4a4a; border-color: #a55; }
  .empty-note { color: #7a7a85; font-size: 13px; font-style: italic; }
</style></head>
<body>
<header>
  <h1>PYQ Image Reviewer</h1>
  <div id="progress"></div>
  <button class="primary" onclick="downloadDecisions()">Download decisions</button>
</header>
<main id="app"></main>
<script>
const DATA = __DATA_JSON__;
const decisions = {}; // id -> {chosen: dataURIorNull, skipped: bool}

function updateProgress() {
  const done = Object.keys(decisions).filter(id => decisions[id].chosen || decisions[id].skipped).length;
  document.getElementById('progress').textContent = done + ' / ' + DATA.length + ' resolved';
}

function selectImage(id, idx, src) {
  decisions[id] = decisions[id] || {};
  decisions[id].chosen = (decisions[id].chosen === src) ? null : src;
  decisions[id].skipped = false;
  render();
}

function toggleSkip(id) {
  decisions[id] = decisions[id] || {};
  decisions[id].skipped = !decisions[id].skipped;
  if (decisions[id].skipped) decisions[id].chosen = null;
  render();
}

function downloadDecisions() {
  const out = {};
  for (const id in decisions) {
    out[id] = { chosen: decisions[id].chosen || null, skipped: !!decisions[id].skipped };
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pyq_review_decisions.json';
  a.click();
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  DATA.forEach(item => {
    const d = decisions[item.id] || {};
    const card = document.createElement('div');
    card.className = 'card' + (d.chosen ? ' decided' : '') + (d.skipped ? ' skipped' : '');

    let optsHtml = '';
    if (item.options) {
      optsHtml = '<div class="opts">' + ['A','B','C','D'].map(k =>
        (k===item.answer ? '<b>' : '') + k + ': ' + (item.options[k]||'') + (k===item.answer ? ' ✓</b>' : '')
      ).join(' &nbsp; ') + '</div>';
    } else if (item.answer) {
      optsHtml = '<div class="answer">Known answer: <b>' + item.answer + '</b> (options are the diagrams below — pick the one showing all choices, or the one matching option ' + item.answer + ')</div>';
    }

    const pagesHtml = item.pages.length
      ? '<div class="section-label">Page context</div><div class="pagerow">' +
        item.pages.map(src => '<img src="' + src + '">').join('') + '</div>'
      : '';

    const candsHtml = item.candidates.length
      ? '<div class="section-label">Candidate images — click to pick one</div><div class="imgs">' +
        item.candidates.map((src, i) =>
          '<img src="' + src + '" class="' + (d.chosen===src ? 'selected' : '') + '" onclick="selectImage(\\'' + item.id + '\\',' + i + ',this.src)">'
        ).join('') + '</div>'
      : '<div class="empty-note">No candidate images were extracted for this one — use the page context above, or skip.</div>';

    card.innerHTML =
      '<div class="meta"><span class="badge">' + item.subject + '</span><span class="badge">' + item.reason + '</span>' + item.file + '</div>' +
      '<div class="qtext">' + item.question.replace(/</g,'&lt;') + '</div>' +
      optsHtml + pagesHtml + candsHtml +
      '<div class="actions"><button class="skip' + (d.skipped ? ' active' : '') + '" onclick="toggleSkip(\\'' + item.id + '\\')">' +
      (d.skipped ? 'Skipped (click to undo)' : 'Skip this question') + '</button></div>';

    app.appendChild(card);
  });
  updateProgress();
}

render();
</script>
</body></html>
"""
    html_doc = html_doc.replace("__DATA_JSON__", data_json)
    OUTPUT_FILE.write_text(html_doc, encoding="utf-8")
    size_mb = OUTPUT_FILE.stat().st_size / 1e6
    print(f"Wrote {OUTPUT_FILE} ({size_mb:.1f} MB)")
    print(f"Open it in a browser, review all {len(review)} questions, then click 'Download decisions'.")


if __name__ == "__main__":
    main()
