import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_MODEL = 'gemini-2.0-flash';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const ai = new GoogleGenAI({ apiKey });
  const { action, payload } = req.body || {};

  try {
    switch (action) {
      case 'extract': {
        const rawContent = payload?.rawContent;
        if (typeof rawContent !== 'string') {
          return res.status(400).json({ error: 'Missing rawContent' });
        }
        const prompt = `Analyze financial data for Hisaab AI. Extract amount, category, date (YYYY-MM-DD), type (income/expense), and description. Data: ${rawContent}`;
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  date: { type: Type.STRING },
                  type: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['amount', 'category', 'date', 'type', 'description'],
                propertyOrdering: ['amount', 'category', 'date', 'type', 'description'],
              },
            },
          },
        });
        const text = (response as { text?: string }).text ?? '';
        const parsed = text.trim() ? JSON.parse(text.trim()) : [];
        return res.status(200).json(parsed);
      }

      case 'receipt': {
        const base64Image = payload?.base64Image;
        if (typeof base64Image !== 'string') {
          return res.status(400).json({ error: 'Missing base64Image' });
        }
        const data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        if (!data) {
          return res.status(400).json({ error: 'Invalid base64 image data' });
        }
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data } },
              {
                text: 'Analyze this receipt image for Hisaab AI. Extract: amount (number), category (one word), date (YYYY-MM-DD), type (expense/income), and description. Output JSON.',
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
                date: { type: Type.STRING },
                type: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['amount', 'category', 'date', 'type', 'description'],
              propertyOrdering: ['amount', 'category', 'date', 'type', 'description'],
            },
          },
        });
        const text = (response as { text?: string }).text ?? '';
        const parsed = text.trim() ? JSON.parse(text.trim()) : null;
        return res.status(200).json(parsed);
      }

      case 'rates': {
        const baseCurrency = payload?.baseCurrency ?? 'EUR';
        const targets = Array.isArray(payload?.targets) ? payload.targets : ['PKR'];
        const prompt = `Fetch current live exchange rate for 1 ${baseCurrency} to ${targets.join(', ')}. Use Google Search grounding. Return ONLY a JSON object containing the rates.`;
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
          config: { tools: [{ googleSearch: {} }] },
        });
        const text = ((response as { text?: string }).text ?? '').trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const rates = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        return res.status(200).json(rates);
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('Gemini API error:', err);
    return res.status(500).json({ error: 'AI request failed' });
  }
}
