import { generateLayout } from '../llm/gemini.js';
import { log, error } from '../utils/logger.js';

const PT_TO_PX = 4 / 3;

export async function runLayoutAgent(ctx) {
  log('layoutAgent', `generating visual skeleton from ${ctx.pdfScreenshots?.length || 0} screenshot(s)`);

  if (!ctx.pdfScreenshots || ctx.pdfScreenshots.length === 0) {
    ctx.errors.push('layoutAgent: no PDF screenshots available. Cannot reconstruct layout.');
    return ctx;
  }

  const pageW = ctx.pdfLayout?.screenshotW
    ? Math.round(ctx.pdfLayout.screenshotW / 1.5)
    : Math.round((ctx.pdfLayout?.pageWidth || 595) * PT_TO_PX);
  const pageH = ctx.pdfLayout?.screenshotH
    ? Math.round(ctx.pdfLayout.screenshotH / 1.5)
    : Math.round((ctx.pdfLayout?.pageHeight || 842) * PT_TO_PX);

  ctx.pageW = pageW;
  ctx.pageH = pageH;

  try {
    const result = await generateLayout(ctx.pdfScreenshots, pageW, pageH);
    ctx.layoutHtml = result.html;
    ctx.layoutCss = result.css;
    ctx.emit?.('🎨 Layout skeleton generated');
    log('layoutAgent', `layout skeleton ready — HTML=${ctx.layoutHtml.length}c CSS=${ctx.layoutCss.length}c`);
  } catch (err) {
    error('layoutAgent', err.message);
    ctx.errors.push(`layoutAgent failed: ${err.message}`);
  }

  return ctx;
}
