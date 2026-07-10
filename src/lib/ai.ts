// Shared Gemini helper used by the AI Tutor, AI Companion, and AI reports.
//
// The key is read from VITE_GEMINI_API_KEY (see .env.local). If it is missing
// the callers fall back to non-AI behaviour, so the app still works offline.
//
// Every call records platform-wide usage counters in Firestore (_meta/aiUsage)
// so the admin dashboard can show real AI usage, health and availability.

import { doc, setDoc, getDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from './firebase';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

export function hasAI(): boolean {
  return Boolean(GEMINI_KEY);
}

export interface AskOptions {
  maxTokens?: number;
  temperature?: number;
}

function usageDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Best-effort platform-wide AI usage counters (read by the admin dashboard). */
function recordUsage(ok: boolean, latencyMs: number): void {
  try {
    const day = usageDayKey();
    void setDoc(doc(db, '_meta', 'aiUsage'), {
      totalCalls: increment(1),
      totalErrors: increment(ok ? 0 : 1),
      days: { [day]: { calls: increment(1), errors: increment(ok ? 0 : 1) } },
      lastLatencyMs: latencyMs,
      lastStatus: ok ? 'ok' : 'error',
      lastCallAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch { /* never block the caller */ }
}

async function callModel(model: string, prompt: string, opts: AskOptions): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
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
          ...(model === MODEL ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    },
  );
}

/** Send a single prompt to Gemini and return the text reply. Throws on failure. */
export async function askAI(prompt: string, opts: AskOptions = {}): Promise<string> {
  if (!GEMINI_KEY) throw new Error('No API key');

  const start = Date.now();
  let res = await callModel(MODEL, prompt, opts);
  // If the primary model is unavailable (quota / model errors), retry on the fallback.
  if (!res.ok && [404, 429, 500, 503].includes(res.status)) {
    res = await callModel(FALLBACK_MODEL, prompt, opts);
  }

  if (!res.ok) {
    recordUsage(false, Date.now() - start);
    throw new Error(`Gemini error ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    recordUsage(false, Date.now() - start);
    throw new Error('Empty response');
  }
  recordUsage(true, Date.now() - start);
  return text.trim();
}

// ── Health / status (admin dashboard) ─────────────────────────────────────────

export interface AIStatus {
  configured: boolean;
  reachable: boolean | null;   // null = not yet checked
  latencyMs: number | null;
  model: string;
  checkedAt: string | null;
}

/** Live health check: sends a minimal prompt and measures latency. */
export async function pingAI(): Promise<AIStatus> {
  const base: AIStatus = { configured: hasAI(), reachable: null, latencyMs: null, model: MODEL, checkedAt: new Date().toISOString() };
  if (!hasAI()) return { ...base, reachable: false };
  const start = Date.now();
  try {
    await askAI('Reply with the single word: OK', { maxTokens: 10, temperature: 0 });
    return { ...base, reachable: true, latencyMs: Date.now() - start };
  } catch {
    return { ...base, reachable: false, latencyMs: Date.now() - start };
  }
}

export interface AIUsageSummary {
  totalCalls: number;
  totalErrors: number;
  todayCalls: number;
  todayErrors: number;
  lastLatencyMs: number | null;
  lastStatus: string | null;
  lastCallAt: string | null;
}

/** Platform-wide usage counters recorded by every askAI call. */
export async function getAIUsage(): Promise<AIUsageSummary> {
  const empty: AIUsageSummary = { totalCalls: 0, totalErrors: 0, todayCalls: 0, todayErrors: 0, lastLatencyMs: null, lastStatus: null, lastCallAt: null };
  try {
    const snap = await getDoc(doc(db, '_meta', 'aiUsage'));
    if (!snap.exists()) return empty;
    const d = snap.data();
    const today = (d.days as Record<string, { calls?: number; errors?: number }> | undefined)?.[usageDayKey()];
    const lastCallAt = d.lastCallAt;
    return {
      totalCalls: (d.totalCalls as number) ?? 0,
      totalErrors: (d.totalErrors as number) ?? 0,
      todayCalls: today?.calls ?? 0,
      todayErrors: today?.errors ?? 0,
      lastLatencyMs: (d.lastLatencyMs as number) ?? null,
      lastStatus: (d.lastStatus as string) ?? null,
      lastCallAt: lastCallAt && typeof lastCallAt.toDate === 'function' ? lastCallAt.toDate().toISOString() : null,
    };
  } catch {
    return empty;
  }
}
