import { runPlanningAgent } from './planningAgent.js';
import { runRendererAgent } from './rendererAgent.js';
import { runQaAgent } from './qaAgent.js';
import { runRepairAgent } from './repairAgent.js';
import { runParserAgent } from './parserAgent.js';
import { runScreenshotAgent } from './screenshotAgent.js';
import { runLayoutAgent } from './layoutAgent.js';
import { runTextAgent } from './textAgent.js';
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

      emit('🎨 Reconstructing visual layout from screenshots...');
      await runLayoutAgent(ctx);
      if (ctx.errors.length > 0) return ctx;
      emit('🎨 Layout skeleton ready');

      emit('✍️ Placing text content (attempt 1)...');
      await runTextAgent(ctx);

      emit('🔍 Comparing with original PDF...');
      await runValidatorAgent(ctx);

      let layoutRetried = false;

      while (!ctx.validatorPass && ctx.attempt < MAX_RETRIES) {
        ctx.attempt++;
        const score = ctx.validatorScore ?? '?';
        emit(`⚠️ Score ${score}/100 — below threshold, correction attempt ${ctx.attempt}/${MAX_RETRIES}`);

        if (ctx.validatorScore !== null && ctx.validatorScore < 50 && !layoutRetried) {
          emit('🔁 Score too low — regenerating layout from scratch...');
          layoutRetried = true;
          await runLayoutAgent(ctx);
          if (ctx.errors.length > 0) break;
          emit('🎨 New layout skeleton ready');
        }

        emit(`✍️ Placing text content (attempt ${ctx.attempt + 1})...`);
        await runTextAgent(ctx);
        emit('🔍 Comparing with original PDF...');
        await runValidatorAgent(ctx);
      }

      if (ctx.validatorPass) {
        emit(`✅ Score ${ctx.validatorScore}/100 — validation passed!`);
      } else {
        emit(`⚠️ Max retries reached. Best score: ${ctx.validatorScore ?? '?'}/100. Returning best attempt.`);
        ctx.warnings.push(`Max retries (${MAX_RETRIES}) reached. Best score: ${ctx.validatorScore ?? '?'}/100.`);
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
