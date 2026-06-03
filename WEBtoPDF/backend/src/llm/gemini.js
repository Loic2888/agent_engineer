import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function ask(systemPrompt, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

export async function askJson(systemPrompt, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(userPrompt);
  return JSON.parse(result.response.text());
}

// Agent 1 — Reproduit la STRUCTURE VISUELLE depuis les screenshots.
// Retourne HTML+CSS avec des placeholders à la place du vrai texte.
export async function generateLayout(screenshots, pageW, pageH) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const parts = [
    ...screenshots.map(s => ({ inlineData: { mimeType: 'image/png', data: s.toString('base64') } })),
    {
      text: `You are a web designer. Analyze these ${screenshots.length} PDF page screenshot(s) and reproduce the visual layout as HTML+CSS.

FOCUS ONLY ON VISUAL STRUCTURE:
- Exact layout (columns, widths, positions)
- Background colors, text colors, border colors
- Font sizes and font weights (relative hierarchy)
- Spacing, padding, margins
- Visual sections and their boundaries

FOR TEXT CONTENT: use generic placeholders only:
- Headings → "[HEADING]"
- Short labels → "[LABEL]"
- Body paragraphs → "[BODY TEXT CONTENT]"
- List items → "[LIST ITEM]"
- Names/titles → "[NAME]", "[TITLE]"
Do NOT use any real text from the screenshots.

TECHNICAL RULES:
- One <div class="page"> per screenshot (${screenshots.length} total)
- Each .page: width ${pageW}px, height ${pageH}px, overflow hidden, position relative
- CSS fully self-contained in <style> tag
- Use flexbox/grid to match the visible column structure

Return JSON: {"html": "...", "css": "..."}`,
    },
  ];

  const result = await model.generateContent(parts);
  return JSON.parse(result.response.text());
}

// Agent 2 — Injecte le vrai texte dans le layout aux bons emplacements.
// Retourne HTML+CSS avec le contenu réel à la place des placeholders.
export async function placeText(layoutHtml, layoutCss, structuredText, screenshots, feedback) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const parts = [
    ...screenshots.map(s => ({ inlineData: { mimeType: 'image/png', data: s.toString('base64') } })),
    {
      text: `You are a web developer. You have:
1. An HTML/CSS layout skeleton (with placeholder text)
2. The real text content extracted from the PDF
3. Screenshots of the original PDF pages (showing exactly where each text appears)

YOUR TASK: Replace every placeholder in the layout with the correct real text, placed at the correct position matching the screenshots.

--- HTML LAYOUT SKELETON ---
${layoutHtml}

--- CSS ---
${layoutCss}

--- REAL TEXT CONTENT (extracted from PDF) ---
${structuredText}

RULES:
- Keep the exact same HTML structure and CSS — do NOT change layout, colors, or fonts
- Replace [HEADING], [LABEL], [BODY TEXT CONTENT], [LIST ITEM], [NAME], [TITLE] etc. with the real text
- Use the screenshots to verify which text goes where
- Every piece of text from the PDF must appear in the output
- If a section has multiple items, repeat the HTML pattern for each item${feedback ? `\n\nCORRECTIONS REQUIRED FROM PREVIOUS ATTEMPT:\n${feedback}` : ''}

Return JSON: {"html": "...", "css": "..."}`,
    },
  ];

  const result = await model.generateContent(parts);
  return JSON.parse(result.response.text());
}

// Agent 3 — Compare screenshot PDF original vs screenshot HTML rendu.
// Retourne { score: 0-100, fixes: string[] }
export async function compareImages(pdfScreenshot, htmlScreenshot) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/png', data: pdfScreenshot.toString('base64') } },
    { inlineData: { mimeType: 'image/png', data: htmlScreenshot.toString('base64') } },
    {
      text: `Compare these two document screenshots.
Image 1: Original PDF page (ground truth).
Image 2: HTML/CSS reproduction.

Return JSON:
{
  "score": <integer 0-100, overall visual similarity>,
  "fixes": [
    "<specific actionable fix 1>",
    "<specific actionable fix 2>",
    ...
  ]
}

Each fix must be specific and actionable, for example:
- "Left sidebar background should be dark navy #1e2b3c, currently white"
- "Section heading 'CONTACT' is missing the orange color and horizontal separator"
- "Right column text is too large, should be ~11px"
- "The two-column layout is missing — add flexbox with left:30% right:70%"`,
    },
  ]);

  return JSON.parse(result.response.text());
}
