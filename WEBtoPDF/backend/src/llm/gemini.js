import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000];

function isTransient(err) {
  const msg = String(err?.message ?? err);
  return /\b(503|429)\b|service unavailable|high demand|overloaded|unavailable|resource_exhausted|rate limit/i.test(msg);
}

// Appelle generateContent avec retry exponentiel sur les erreurs transitoires
// (503 surcharge modèle, 429 rate limit). Relance l'erreur si non transitoire
// ou après épuisement des tentatives.
async function generateWithRetry(model, payload, label = 'gemini') {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await model.generateContent(payload);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === RETRY_DELAYS_MS.length) throw err;
      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(`⚠ ${label}: Gemini indisponible (transitoire), retry ${attempt + 1}/${RETRY_DELAYS_MS.length} dans ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function ask(systemPrompt, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });
  const result = await generateWithRetry(model, userPrompt, 'ask');
  return result.response.text();
}

export async function askJson(systemPrompt, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await generateWithRetry(model, userPrompt, 'askJson');
  return JSON.parse(result.response.text());
}

// Passe d'enrichissement visuel — le texte est DÉJÀ positionné exactement par
// le builderAgent. Gemini ne fait qu'ajouter les couleurs, fonds et polices en
// regardant le screenshot du PDF. Il ne doit jamais déplacer ni supprimer un span.
export async function enhanceStyles(html, css, screenshot, corrections) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const parts = [
    { inlineData: { mimeType: 'image/png', data: screenshot.toString('base64') } },
    {
      text: `You are styling an HTML page that reproduces the attached PDF screenshot.
The text is ALREADY positioned at the exact correct coordinates. Your ONLY job is
to make the colors, backgrounds, fonts and decorations match the screenshot.

--- CURRENT HTML ---
${html}

--- CURRENT CSS ---
${css}

ABSOLUTE RULES (breaking these ruins the result):
- Keep EVERY <span class="t"> exactly as-is: never change, move, or delete its
  inline left/top/font-size, and never remove any span. All text must stay.
- You MAY change colors (text color, .page background), font-family, font-weight.
- For colored zones/sidebars/boxes visible in the screenshot: add decorative
  <div> elements with position:absolute and a LOW z-index (e.g. z-index:0) so they
  sit BEHIND the text. Give .t a higher stacking by adding "z-index:1" via CSS.
- Match the page background and any colored side panels precisely (use hex colors
  sampled from the screenshot).
- Keep the A4 page dimensions (.page width/height) unchanged.
${corrections ? `\n--- SPECIFIC FIXES REQUESTED ---\n${corrections}\n` : ''}
Return JSON: {"html": "...", "css": "..."}`,
    },
  ];

  const result = await generateWithRetry(model, parts, 'styleAgent');
  return JSON.parse(result.response.text());
}

// Agent 3 — Compare screenshot PDF original vs screenshot HTML rendu.
// Retourne { score: 0-100, fixes: string[] }
export async function compareImages(pdfScreenshot, htmlScreenshot) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await generateWithRetry(model, [
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
