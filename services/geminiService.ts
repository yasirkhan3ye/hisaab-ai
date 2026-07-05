import { CapacitorHttp } from '@capacitor/core';

/**
 * AI service – calls server-side API (keeps API key secure).
 * For local development with AI features, run: vercel dev
 */

const getApiBase = () => {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    // We use the local IP to ensure the phone can reach the computer over Wi-Fi
    // Your current computer IP: 192.168.43.48
    return 'http://192.168.43.48:3000/api';
  }
  return '/api';
};

const API_BASE = getApiBase();

async function callGemini<T>(action: string, payload: unknown): Promise<T> {
  // Use CapacitorHttp for native platforms to bypass Mixed Content/CORS restrictions
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    const options = {
      url: `${API_BASE}/gemini`,
      headers: { 'Content-Type': 'application/json' },
      data: { action, payload },
      connectTimeout: 5000,
      readTimeout: 5000
    };

    try {
      const response = await CapacitorHttp.post(options);
      if (response.status !== 200) {
        throw new Error(response.data?.error || `AI request failed (${response.status})`);
      }
      return response.data;
    } catch (err: any) {
      console.error("CapacitorHttp Error:", err);
      throw new Error('Connection to computer failed. Make sure your computer and phone are on the same Wi-Fi and "vercel dev" is running.');
    }
  }

  // Fallback for Web
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_BASE}/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'AI request failed');
    }
    return res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timed out.');
    throw err;
  }
}

export const extractTransactionsFromText = async (rawContent: string) => {
  try {
    const parsed = await callGemini<unknown[]>('extract', { rawContent });
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const fetchExchangeRates = async (baseCurrency: string, targets: string[]) => {
  try {
    return await callGemini<Record<string, number> | null>('rates', { baseCurrency, targets });
  } catch {
    return null;
  }
};
