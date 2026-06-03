import puppeteer from 'puppeteer-core';
import { log, error } from '../utils/logger.js';
import { tempPath } from '../utils/fileHelpers.js';

export async function runRendererAgent(ctx) {
  log('rendererAgent', 'launching Puppeteer');
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const htmlFile = ctx.plan.htmlFiles[0];
    let finalHtml = htmlFile.buffer.toString('utf-8');

    for (const cssFile of ctx.plan.cssFiles) {
      const cssContent = cssFile.buffer.toString('utf-8');
      finalHtml = finalHtml.replace('</head>', `<style>${cssContent}</style></head>`);
    }
    if (ctx.repair?.cssOverride) {
      finalHtml = finalHtml.replace('</head>', `<style>${ctx.repair.cssOverride}</style></head>`);
    }

    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    const outputPath = tempPath('.pdf');
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true });
    ctx.outputPath = outputPath;
    log('rendererAgent', `PDF written to ${outputPath}`);
  } catch (err) {
    error('rendererAgent', err.message);
    ctx.errors.push(err.message);
  } finally {
    await browser.close();
  }

  return ctx;
}
