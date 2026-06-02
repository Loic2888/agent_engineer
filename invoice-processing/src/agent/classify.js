import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function classify(content) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are a document classifier. Respond ONLY with valid JSON: {"is_invoice": true} or {"is_invoice": false}. No other text.',
  });

  const parts = buildParts(content);
  const result = await model.generateContent(parts);
  const text = result.response.text().trim();

  try {
    const parsed = JSON.parse(text);
    return parsed.is_invoice === true;
  } catch {
    return text.toLowerCase().includes('true');
  }
}

function buildParts(content) {
  if (typeof content === 'string' && content.startsWith('{"__image__":')) {
    const { base64, mime } = JSON.parse(content);
    return [
      { inlineData: { data: base64, mimeType: mime } },
      { text: 'Is this document an invoice? Reply with JSON only.' },
    ];
  }
  return [`Is this document an invoice?\n\n${content}`];
}
