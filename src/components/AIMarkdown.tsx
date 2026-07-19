import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders AI-generated text (Gemini chat replies, test analyses, faculty
// reports) as real Markdown — bold, italics, lists, headings, code, links —
// instead of showing raw "**" characters. react-markdown parses only the
// Markdown AST into React elements and never injects raw HTML from the
// source text, so this stays safe against XSS even though the content
// comes from an LLM. Typography lives in the .ai-markdown rules in index.css
// so every usage site (chat bubbles, analysis panels, report cards) looks
// consistent without repeating styles here.
export default function AIMarkdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`ai-markdown ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
