import { placeText } from '../llm/gemini.js';
import { log, error } from '../utils/logger.js';

export async function runTextAgent(ctx) {
  log('textAgent', `attempt=${ctx.attempt} — injecting real text into layout`);

  if (!ctx.layoutHtml || !ctx.layoutCss) {
    ctx.errors.push('textAgent: no layout skeleton available. Run layoutAgent first.');
    return ctx;
  }

  const structuredText = buildTextSummary(ctx.structuredContent, ctx.parsedText);
  const feedback = ctx.validatorFixes?.length > 0
    ? ctx.validatorFixes.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : null;

  try {
    const result = await placeText(
      ctx.layoutHtml,
      ctx.layoutCss,
      structuredText,
      ctx.pdfScreenshots || [],
      feedback
    );
    ctx.outputHtml = result.html;
    ctx.outputCss = result.css;
    ctx.emit?.('✍️ Text placed in layout');
    log('textAgent', `text placed — HTML=${ctx.outputHtml.length}c CSS=${ctx.outputCss.length}c`);
  } catch (err) {
    error('textAgent', err.message);
    ctx.errors.push(`textAgent failed: ${err.message}`);
  }

  return ctx;
}

function buildTextSummary(sc, fallbackText) {
  if (!sc) return fallbackText || '';

  if (sc.type === 'two-column') {
    return `LEFT COLUMN:\n${formatLines(sc.leftColumn)}\n\nRIGHT COLUMN:\n${formatLines(sc.rightColumn)}`;
  }
  return formatLines(sc.content);
}

function formatLines(lines) {
  if (!lines || lines.length === 0) return '';
  return lines.map(l => l.isHeading ? `\n[HEADING] ${l.text}` : l.text).join('\n');
}
