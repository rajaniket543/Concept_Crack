import { useMemo, type CSSProperties } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Renders question/option text that may contain LaTeX math. Math is written with
// standard delimiters — $...$ or \(...\) for inline, $$...$$ or \[...\] for
// display — and rendered with KaTeX. Everything outside the delimiters is plain
// text (HTML-escaped). Text with no delimiters renders exactly as before, so
// swapping this in for a bare {text} is always safe.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// $$...$$ | \[...\]  (display)   ·   $...$ | \(...\)  (inline)
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

function renderMathHtml(text: string): string {
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  MATH_RE.lastIndex = 0;
  while ((m = MATH_RE.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
    try {
      out += katex.renderToString(tex, { throwOnError: false, displayMode: display, output: 'html' });
    } catch {
      out += escapeHtml(m[0]); // never let a bad formula break the page
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

export default function MathText({
  text,
  className,
  style,
}: {
  text?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const html = useMemo(() => renderMathHtml(text ?? ''), [text]);
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
