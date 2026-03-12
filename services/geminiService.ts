/**
 * AI service – calls server-side API (keeps API key secure).
 * For local development with AI features, run: vercel dev
 */

const API_BASE = '/api';

async function callGemini<T>(action: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'AI request failed');
  }
  return res.json();
}

export const extractTransactionsFromText = async (rawContent: string) => {
  try {
    const parsed = await callGemini<unknown[]>('extract', { rawContent });
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const analyzeReceipt = async (base64Image: string) => {
  if (!base64Image || typeof base64Image !== 'string') return null;
  const data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  if (!data) return null;
  try {
    return await callGemini<{ amount: number; category: string; date: string; type: string; description: string } | null>(
      'receipt',
      { base64Image }
    );
  } catch (err) {
    console.error('Failed to parse receipt data', err);
    return null;
  }
};

export const fetchExchangeRates = async (baseCurrency: string, targets: string[]) => {
  try {
    return await callGemini<Record<string, number> | null>('rates', { baseCurrency, targets });
  } catch {
    return null;
  }
};
