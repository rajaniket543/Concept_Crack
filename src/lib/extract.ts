// AI question extraction from PDFs and images (Feature 5).
//
// Uses Gemini's multimodal endpoint to read an uploaded PDF or image(s) and
// return structured MCQs (question, options, answer, difficulty, subject,
// chapter, topic, explanation) that faculty can then review and edit.

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
// gemini-2.5-flash / gemini-2.0-flash are no longer available on free-tier
// keys for new Google Cloud projects — gemini-flash-lite-latest is a rolling
// alias Google keeps pointed at a currently-supported model.
const MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';
const MAX_TOTAL_BYTES = 18 * 1024 * 1024; // stay under the ~20MB inline-request limit

export interface ExtractedQuestion {
  question:    string;
  options:     { A: string; B: string; C: string; D: string };
  answer:      'A' | 'B' | 'C' | 'D' | null;
  difficulty:  'Easy' | 'Medium' | 'Hard';
  subject:     string;
  chapter:     string;
  topic:       string;
  explanation: string;
  imageUrl?:   string; // question figure, attached manually during review
}

export function extractionAvailable(): boolean {
  return Boolean(GEMINI_KEY);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

function normalize(q: Record<string, unknown>): ExtractedQuestion {
  const opts = (q.options ?? {}) as Record<string, unknown>;
  const rawAns = String(q.answer ?? '').trim().toUpperCase().charAt(0);
  const answer = (['A', 'B', 'C', 'D'].includes(rawAns) ? rawAns : null) as ExtractedQuestion['answer'];
  const diff = String(q.difficulty ?? 'Medium');
  const difficulty = (DIFFICULTIES as readonly string[]).includes(diff) ? (diff as ExtractedQuestion['difficulty']) : 'Medium';
  return {
    question:    String(q.question ?? '').trim(),
    options:     { A: String(opts.A ?? ''), B: String(opts.B ?? ''), C: String(opts.C ?? ''), D: String(opts.D ?? '') },
    answer,
    difficulty,
    subject:     String(q.subject ?? '').trim(),
    chapter:     String(q.chapter ?? '').trim(),
    topic:       String(q.topic ?? '').trim(),
    explanation: String(q.explanation ?? '').trim(),
  };
}

function parseQuestions(text: string): ExtractedQuestion[] {
  const cleaned = text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  if (start === -1) return [];
  const end = cleaned.lastIndexOf(']');

  let arr: unknown = null;
  if (end > start) {
    try { arr = JSON.parse(cleaned.slice(start, end + 1)); } catch { arr = null; }
  }

  // Salvage a truncated response (e.g. output hit the token limit): cut back to
  // the last complete object and close the array, so extraction still succeeds.
  if (!Array.isArray(arr)) {
    const lastComplete = cleaned.lastIndexOf('}');
    if (lastComplete > start) {
      try { arr = JSON.parse(cleaned.slice(start, lastComplete + 1) + ']'); } catch { return []; }
    }
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object' && typeof (q as Record<string, unknown>).question === 'string')
    .map(normalize)
    .filter(q => q.question.length > 0);
}

async function callGemini(model: string, parts: Array<Record<string, unknown>>, opts: { maxOutputTokens: number; temperature: number }): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: opts.maxOutputTokens,
          temperature: opts.temperature,
          responseMimeType: 'application/json',
          ...(model === MODEL ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    },
  );
}

export async function extractQuestionsFromFiles(
  files: File[],
  hint?: { subject?: string; chapter?: string },
): Promise<ExtractedQuestion[]> {
  if (!GEMINI_KEY) throw new Error('AI extraction is not configured — add a Gemini API key to enable it.');
  if (files.length === 0) return [];

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error('Files are too large (max ~18 MB total). Try fewer pages or split the PDF.');
  }

  const prompt =
    `You are an exam-question extraction engine for Indian JEE/NEET coaching material.\n` +
    `Extract EVERY multiple-choice question from the attached file(s). For each question output:\n` +
    `- "question": full question text. Write any mathematical/chemical formula as LaTeX wrapped in $...$ (inline) or $$...$$ (display) — e.g. $\\frac{v^2}{r}$, $\\int_0^1 x\\,dx$. If a diagram/figure is essential to the question, describe it briefly inside [square brackets].\n` +
    `- "options": an object with keys A, B, C, D (exactly four; leave a value "" if the source truly has fewer). Use the same $...$ LaTeX convention for any formula in an option.\n` +
    `- "answer": the correct option letter (A/B/C/D) if the source indicates it, otherwise null.\n` +
    `- "difficulty": your best estimate — one of Easy, Medium, Hard.\n` +
    `- "subject": Physics, Chemistry, Mathematics, or Biology${hint?.subject ? ` (likely ${hint.subject})` : ''}.\n` +
    `- "chapter": the chapter name${hint?.chapter ? ` (likely ${hint.chapter})` : ''}.\n` +
    `- "topic": a more specific sub-topic if identifiable, else "".\n` +
    `- "explanation": the solution/explanation if present in the source, else "".\n` +
    `Preserve the original wording. Reply with ONLY a JSON array of these objects.`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const file of files) {
    const data = await fileToBase64(file);
    parts.push({ inlineData: { mimeType: file.type || 'application/octet-stream', data } });
  }

  const genOpts = { maxOutputTokens: 8192, temperature: 0.1 };
  let res = await callGemini(MODEL, parts, genOpts);
  // Primary model unavailable (quota / outage / model retired) → retry on fallback.
  if (!res.ok && [404, 429, 500, 503].includes(res.status)) {
    res = await callGemini(FALLBACK_MODEL, parts, genOpts);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Extraction failed (${res.status}). ${detail.slice(0, 140)}`);
  }
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const questions = parseQuestions(text);
  if (questions.length === 0) throw new Error('No questions could be detected in the uploaded file(s). Make sure the PDF/photo contains readable MCQs and try again.');
  return questions;
}

// ── AI generation with an explicit difficulty distribution (Feature 6) ──────────

export interface GenerateSpec {
  subject: string;
  chapter: string;
  topic?:  string;
  easy:    number;
  medium:  number;
  hard:    number;
}

export async function generateQuestionsAI(spec: GenerateSpec): Promise<ExtractedQuestion[]> {
  if (!GEMINI_KEY) throw new Error('AI generation is not configured — add a Gemini API key to enable it.');
  const total = spec.easy + spec.medium + spec.hard;
  if (total <= 0) throw new Error('Set at least one question to generate.');
  if (total > 40) throw new Error('Please generate at most 40 questions at a time.');

  const prompt =
    `Generate exam-quality multiple-choice questions for Indian JEE/NEET preparation.\n` +
    `Subject: ${spec.subject}\nChapter: ${spec.chapter}${spec.topic ? `\nTopic: ${spec.topic}` : ''}\n\n` +
    `Produce EXACTLY this difficulty distribution (the counts must match precisely):\n` +
    `- ${spec.easy} Easy question(s)\n- ${spec.medium} Medium question(s)\n- ${spec.hard} Hard question(s)\n` +
    `Total = ${total}.\n\n` +
    `For each question output an object with:\n` +
    `- "question": the question text (write any formula as LaTeX in $...$ inline or $$...$$ display)\n` +
    `- "options": an object with keys A, B, C, D — four distinct, plausible options (formulas as $...$ LaTeX)\n` +
    `- "answer": the correct option letter (A/B/C/D)\n` +
    `- "difficulty": "Easy" | "Medium" | "Hard" (matching the requested counts)\n` +
    `- "subject": "${spec.subject}"\n- "chapter": "${spec.chapter}"\n- "topic": ${spec.topic ? `"${spec.topic}"` : '"" or a specific sub-topic'}\n` +
    `- "explanation": a concise worked solution\n\n` +
    `Reply with ONLY a JSON array of exactly ${total} objects.`;

  const genOpts = { maxOutputTokens: 8192, temperature: 0.7 };
  let res = await callGemini(MODEL, [{ text: prompt }], genOpts);
  if (!res.ok && [404, 429, 500, 503].includes(res.status)) {
    res = await callGemini(FALLBACK_MODEL, [{ text: prompt }], genOpts);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Generation failed (${res.status}). ${detail.slice(0, 140)}`);
  }
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const questions = parseQuestions(text);
  if (questions.length === 0) throw new Error('The AI did not return any usable questions — try again.');
  return questions;
}
