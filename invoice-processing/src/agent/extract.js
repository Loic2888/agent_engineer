import { GoogleGenerativeAI } from '@google/generative-ai';
import { functionDeclarations } from './tools.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function extract(content) {
  const parts = buildParts(content);
  return callWithRetry(parts);
}

async function callWithRetry(parts, attempt = 1) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are an invoice data extraction specialist. Extract all key fields from the invoice and call the record_invoice function.',
    tools: [{ functionDeclarations }],
    toolConfig: { functionCallingConfig: { mode: 'ANY' } },
  });

  const contents = attempt === 1
    ? [{ role: 'user', parts }]
    : [
        { role: 'user', parts },
        { role: 'model', parts: [{ text: 'I will now call record_invoice with the extracted fields.' }] },
        { role: 'user', parts: [{ text: 'Please call the record_invoice function now with all fields you can find.' }] },
      ];

  const result = await model.generateContent({ contents });
  const candidate = result.response.candidates?.[0];
  const functionCall = candidate?.content?.parts?.find(p => p.functionCall)?.functionCall;

  if (!functionCall) {
    if (attempt === 1) return callWithRetry(parts, 2);
    throw new Error('Gemini did not return a function call after retry.');
  }

  return functionCall.args;
}

function buildParts(content) {
  if (typeof content === 'string' && content.startsWith('{"__image__":')) {
    const { base64, mime } = JSON.parse(content);
    return [
      { inlineData: { data: base64, mimeType: mime } },
      { text: 'Extract all invoice fields and call the record_invoice function.' },
    ];
  }
  return [{ text: `Extract all invoice fields from the text below and call the record_invoice function.\n\n${content}` }];
}
