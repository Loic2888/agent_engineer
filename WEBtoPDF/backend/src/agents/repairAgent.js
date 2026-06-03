import { ask } from '../llm/gemini.js';
import { log } from '../utils/logger.js';

export async function runRepairAgent(ctx) {
  log('repairAgent', `attempt=${ctx.attempt}`);

  const systemPrompt = `You are a CSS expert. Given PDF rendering errors, return ONLY a CSS snippet that fixes @page, page-break, and layout issues so the HTML renders correctly to PDF with Puppeteer. No explanation, just CSS.`;
  const originalCss = ctx.plan.cssFiles.map(f => f.buffer.toString()).join('\n');
  const userPrompt = `Errors:\n${ctx.errors.join('\n')}\n\nOriginal CSS:\n${originalCss}`;

  const cssOverride = await ask(systemPrompt, userPrompt);
  ctx.repair = { cssOverride };
  ctx.errors = [];
  log('repairAgent', 'CSS override generated');

  return ctx;
}
