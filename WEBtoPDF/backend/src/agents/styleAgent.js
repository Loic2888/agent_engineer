import { enhanceStyles } from '../llm/gemini.js';
import { log, error } from '../utils/logger.js';

// Passe d'enrichissement visuel sur le HTML déterministe produit par le builder.
// Gemini ajoute couleurs / fonds / polices SANS toucher au positionnement du texte.
// Garde-fou : si la sortie perd du texte, on la rejette et on garde la version actuelle.
export async function runStyleAgent(ctx) {
  if (!ctx.pdfScreenshots || ctx.pdfScreenshots.length === 0) {
    log('styleAgent', 'no screenshot available — skipping visual enhancement');
    return ctx;
  }
  if (!ctx.outputHtml || !ctx.outputCss) {
    ctx.errors.push('styleAgent: no base HTML/CSS to enhance.');
    return ctx;
  }

  const corrections = ctx.validatorFixes?.length > 0
    ? ctx.validatorFixes.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : null;

  const beforeSpans = countSpans(ctx.outputHtml);

  try {
    const result = await enhanceStyles(ctx.outputHtml, ctx.outputCss, ctx.pdfScreenshots[0], corrections);

    if (!result?.html || !result?.css) {
      throw new Error('Gemini returned incomplete styling output');
    }

    const afterSpans = countSpans(result.html);
    // Rejet si plus de 5% des spans de texte ont disparu
    if (afterSpans < beforeSpans * 0.95) {
      ctx.warnings.push('Style pass dropped text — kept previous version.');
      ctx.emit?.(`⚠️ Style pass dropped text (${beforeSpans}→${afterSpans} spans) — reverted`);
      log('styleAgent', `REVERT — spans ${beforeSpans} → ${afterSpans}`);
      return ctx;
    }

    ctx.outputHtml = result.html;
    ctx.outputCss = result.css;
    ctx.emit?.('🎨 Visual styling applied');
    log('styleAgent', `styling applied — spans ${beforeSpans} → ${afterSpans}`);
  } catch (err) {
    error('styleAgent', err.message);
    ctx.warnings.push(`styleAgent: ${err.message}`);
    // On garde le HTML déterministe existant — pas d'échec fatal
  }

  return ctx;
}

function countSpans(html) {
  return (html.match(/class="t"/g) || []).length;
}
