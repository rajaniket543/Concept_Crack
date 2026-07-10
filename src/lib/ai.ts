// Shared Gemini helper used by the AI Tutor, AI Companion, and AI reports.
//
// The key is read from VITE_GEMINI_API_KEY (see .env.local). If it is missing
// the callers fall back to non-AI behaviour, so the app still works offline.

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = 'gemini-2.5-flash';

export function hasAI(): boolean {
  return Boolean(GEMINI_KEY);
}

export interface AskOptions {
  maxTokens?: number;
  temperature?: number;
}

/** Send a single prompt to Gemini and return the text reply. Throws on failure. */
export async function askAI(prompt: string, opts: AskOptions = {}): Promise<string> {
  if (!GEMINI_KEY) throw new Error('No API key');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // thinkingBudget: 0 stops 2.5-flash spending the whole budget on hidden
        // reasoning (which returns an empty answer for short replies).
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 700,
          temperature: opts.temperature ?? 0.6,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response');
  return text.trim();
}
