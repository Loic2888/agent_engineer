import { runPlanningAgent } from './planningAgent.js';
import { runRendererAgent } from './rendererAgent.js';
import { runQaAgent } from './qaAgent.js';
import { runRepairAgent } from './repairAgent.js';
import { runParserAgent } from './parserAgent.js';
import { runScreenshotAgent } from './screenshotAgent.js';
import { runBuilderAgent } from './builderAgent.js';
import { runStyleAgent } from './styleAgent.js';
import { runValidatorAgent } from './validatorAgent.js';
import { log, error } from '../utils/logger.js';

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '8', 10);

export async function runOrchestrator(files, mode, emit = () => {}) {
  const ctx = {
    mode, files, attempt: 0,
    errors: [], warnings: [],
    output: null, plan: {},
    validatorFixes: [], validatorScore: null,
    emit,
  };

  log('orchestrator', `start mode=${mode}`);

  try {
    await runPlanningAgent(ctx);
    if (ctx.errors.length > 0) return ctx;

    if (mode === 'html-to-pdf') {
      await runRendererAgent(ctx);
      await runQaAgent(ctx);

      while (!ctx.qaPass && ctx.attempt < MAX_RETRIES) {
        ctx.attempt++;
        emit(`🔄 Repair attempt ${ctx.attempt}/${MAX_RETRIES}...`);
        await runRepairAgent(ctx);
        await runRendererAgent(ctx);
        await runQaAgent(ctx);
      }

      if (!ctx.qaPass) ctx.warnings.push(`Max retries (${MAX_RETRIES}) reached.`);
      if (ctx.outputPath) ctx.output = { type: 'pdf', path: ctx.outputPath };

    } else {
      emit('📝 Extracting text content...');
      await runParserAgent(ctx);

      emit(`📸 Taking screenshots of ${ctx.plan.pageCount || '?'} page(s)...`);
      await runScreenshotAgent(ctx);
      emit(`📸 ${ctx.pdfScreenshots?.length || 0} page screenshot(s) ready`);

      // Placement déterministe : le texte est posé à ses coordonnées exactes.
      emit('🧱 Building page from exact text positions...');
      await runBuilderAgent(ctx);
      if (ctx.errors.length > 0) return ctx;

      // Première passe de style (couleurs / fonds) d'après le screenshot.
      emit('🎨 Applying visual styling...');
      await runStyleAgent(ctx);

      emit('🔍 Comparing with original PDF...');
      await runValidatorAgent(ctx);

      // On garde toujours la meilleure version rencontrée.
      let bestScore = ctx.validatorScore ?? 0;
      let bestHtml = ctx.outputHtml;
      let bestCss = ctx.outputCss;

      // Boucle d'amélioration : on n'ajuste QUE le style, jamais les positions.
      while (!ctx.validatorPass && ctx.attempt < MAX_RETRIES) {
        ctx.attempt++;
        const score = ctx.validatorScore ?? '?';
        emit(`⚠️ Score ${score}/100 — refining styling, attempt ${ctx.attempt}/${MAX_RETRIES}`);

        // Repartir de la meilleure version, pas de la dernière (qui peut régresser).
        ctx.outputHtml = bestHtml;
        ctx.outputCss = bestCss;

        await runStyleAgent(ctx);
        emit('🔍 Comparing with original PDF...');
        await runValidatorAgent(ctx);

        if ((ctx.validatorScore ?? 0) > bestScore) {
          bestScore = ctx.validatorScore;
          bestHtml = ctx.outputHtml;
          bestCss = ctx.outputCss;
        }
      }

      // Restituer la meilleure version dans tous les cas.
      ctx.outputHtml = bestHtml;
      ctx.outputCss = bestCss;
      ctx.validatorScore = bestScore;

      if (ctx.validatorPass || bestScore >= 80) {
        emit(`✅ Best score: ${bestScore}/100`);
      } else {
        emit(`⚠️ Max retries reached. Best score: ${bestScore}/100. Returning best attempt.`);
        ctx.warnings.push(`Max retries (${MAX_RETRIES}) reached. Best score: ${bestScore}/100.`);
      }

      if (ctx.outputHtml) ctx.output = { type: 'html', html: ctx.outputHtml, css: ctx.outputCss };
    }

  } catch (err) {
    error('orchestrator', err.message);
    ctx.errors.push(err.message);
    emit(`❌ Error: ${err.message}`);
  }

  return ctx;
}
