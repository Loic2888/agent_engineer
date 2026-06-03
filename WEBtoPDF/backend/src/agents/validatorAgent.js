import puppeteer from 'puppeteer-core';
import { compareImages } from '../llm/gemini.js';
import { log, error } from '../utils/logger.js';

const THRESHOLD = parseInt(process.env.VISUAL_SIMILARITY_THRESHOLD || '80', 10);
const PT_TO_PX = 4 / 3;

export async function runValidatorAgent(ctx) {
  log('validatorAgent', `attempt=${ctx.attempt}, threshold=${THRESHOLD}`);

  if (!ctx.outputHtml || !ctx.outputCss) {
    ctx.errors.push('validatorAgent: no HTML/CSS output to validate.');
    ctx.validatorPass = false;
    return ctx;
  }

  const htmlLow = ctx.outputHtml.toLowerCase();
  if (!htmlLow.includes('<html') && !htmlLow.includes('<!doctype html')) {
    ctx.validatorFixes = ['Output is missing a valid HTML document root (<html> or <!DOCTYPE html>).'];
    ctx.validatorPass = false;
    return ctx;
  }

  if (!ctx.pdfScreenshots || ctx.pdfScreenshots.length === 0) {
    log('validatorAgent', 'no PDF screenshots — falling back to text validation');
    return textValidation(ctx);
  }

  const pageW = ctx.pageW || Math.round((ctx.pdfLayout?.pageWidth || 595) * PT_TO_PX);
  const pageH = ctx.pageH || Math.round((ctx.pdfLayout?.pageHeight || 842) * PT_TO_PX);

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    const page = await browser.newPage();

    // CSS injecté inline
    let renderHtml = ctx.outputHtml;
    const styleTag = `<style>\n${ctx.outputCss}\n</style>`;
    renderHtml = renderHtml.includes('</head>')
      ? renderHtml.replace('</head>', `${styleTag}\n</head>`)
      : styleTag + '\n' + renderHtml;

    await page.setViewport({ width: pageW, height: pageH, deviceScaleFactor: 1 });
    await page.setContent(renderHtml, { waitUntil: 'networkidle0' });

    // Screenshot de la page 1 seulement pour la comparaison
    const htmlScreenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: pageW, height: pageH },
    });

    ctx.emit?.('🔍 Comparing with original PDF...');
    const { score, fixes } = await compareImages(ctx.pdfScreenshots[0], htmlScreenshot);
    log('validatorAgent', `score=${score}/100 threshold=${THRESHOLD} fixes=${fixes?.length || 0}`);

    ctx.validatorScore = score;

    if (score >= THRESHOLD) {
      ctx.validatorPass = true;
      ctx.validatorFixes = [];
      ctx.emit?.(`✅ Score ${score}/100 — validation passed!`);
      log('validatorAgent', 'PASS ✓');
    } else {
      ctx.validatorPass = false;
      ctx.validatorFixes = fixes || [];
      ctx.emit?.(`⚠️ Score ${score}/100 — ${fixes?.length || 0} issue(s) to fix`);
      fixes?.forEach((f, i) => ctx.emit?.(`   ${i + 1}. ${f}`));
      log('validatorAgent', `FAIL — ${ctx.validatorFixes.length} fixes required`);
    }

  } catch (err) {
    error('validatorAgent', `visual comparison error: ${err.message}`);
    return textValidation(ctx);
  } finally {
    if (browser) await browser.close();
  }

  return ctx;
}

function textValidation(ctx) {
  const fixes = [];
  if (!ctx.outputHtml.toLowerCase().includes('<body')) fixes.push('Missing <body> tag.');
  if (!ctx.outputCss || ctx.outputCss.trim().length < 50) fixes.push('CSS is too minimal — page will be unstyled.');

  if (ctx.parsedText) {
    const words = ctx.parsedText.split(/\s+/).filter(w => w.length > 5 && /^[\wÀ-ÿ]+$/.test(w)).slice(0, 20);
    const missing = words.filter(w => !ctx.outputHtml.includes(w));
    if (missing.length > words.length * 0.4) {
      fixes.push(`Missing text content — words not found: ${missing.slice(0, 5).join(', ')}.`);
    }
  }

  ctx.validatorPass = fixes.length === 0;
  ctx.validatorFixes = fixes;
  return ctx;
}
