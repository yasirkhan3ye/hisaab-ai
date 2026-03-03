import { GoogleGenAI, Type } from "@google/genai";

// Always use process.env.API_KEY directly in the configuration object.
export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const extractTransactionsFromText = async (rawContent: string) => {
  const ai = getGeminiClient();
  const prompt = `Analyze financial data for Hisaab AI. Extract amount, category, date (YYYY-MM-DD), type (income/expense), and description. Data: ${rawContent}`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
            description: { type: Type.STRING }
          },
          required: ['amount', 'category', 'date', 'type', 'description'],
          propertyOrdering: ["amount", "category", "date", "type", "description"]
        }
      }
    }
  });
  try { return JSON.parse(response.text.trim()); } catch { return []; }
};

export const analyzeReceipt = async (base64Image: string) => {
  const ai = getGeminiClient();
  const data = base64Image.split(',')[1];

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: data
          }
        },
        {
          text: 'Analyze this receipt image for Hisaab AI. Extract: amount (number), category (one word), date (YYYY-MM-DD), type (expense/income), and description. Output JSON.'
        }
      ]
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
          description: { type: Type.STRING }
        },
        required: ['amount', 'category', 'date', 'type', 'description'],
        propertyOrdering: ["amount", "category", "date", "type", "description"]
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (err) {
    console.error("Failed to parse receipt data", err);
    return null;
  }
};

export const fetchExchangeRates = async (baseCurrency: string, targets: string[]) => {
  const ai = getGeminiClient();
  const prompt = `Fetch current live exchange rate for 1 ${baseCurrency} to ${targets.join(', ')}. Use Google Search grounding. Return ONLY a JSON object containing the rates.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
    }
  });
  // Since search grounding response.text might not be clean JSON, use a safer extraction.
  try {
    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }
};
