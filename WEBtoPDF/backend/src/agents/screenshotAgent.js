import puppeteer from 'puppeteer-core';
import { log, error } from '../utils/logger.js';

const PORT = process.env.PORT || 3002;

export async function runScreenshotAgent(ctx) {
  log('screenshotAgent', 'rendering all PDF pages to screenshots via pdfjs');

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const pdfBase64 = ctx.files[0].buffer.toString('base64');
    const scale = 1.5;
    const pdfjsBase = `http://localhost:${PORT}/pdfjs`;
    const totalPages = ctx.plan?.pageCount || 1;

    // Rend toutes les pages dans des canvas empilés
    await page.setContent(`<!DOCTYPE html>
<html><head>
<style>* { margin:0; padding:0; } body { background:#fff; }</style>
</head><body>
<div id="canvases"></div>
<script src="${pdfjsBase}/build/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfjsBase}/build/pdf.worker.min.js';
(async () => {
  try {
    const raw = atob('${pdfBase64}');
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
    const container = document.getElementById('canvases');
    window._pageCount = pdf.numPages;
    window._pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n);
      const vp = p.getViewport({ scale: ${scale} });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      c.id = 'page-' + n;
      container.appendChild(c);
      await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      window._pages.push({ w: vp.width, h: vp.height });
    }
    document.title = 'READY';
  } catch(e) {
    document.title = 'ERROR:' + e.message;
  }
})();
</script>
</body></html>`, { waitUntil: 'networkidle0' });

    await page.waitForFunction(
      () => document.title.startsWith('READY') || document.title.startsWith('ERROR'),
      { timeout: 60000 }
    );

    const title = await page.title();
    if (title.startsWith('ERROR')) throw new Error(title.replace('ERROR:', ''));

    const pageMeta = await page.evaluate(() => window._pages);
    ctx.pdfScreenshots = [];

    for (let n = 1; n <= pageMeta.length; n++) {
      const { w, h } = pageMeta[n - 1];
      ctx.emit?.(`📸 Screenshot page ${n}/${pageMeta.length}...`);
      const canvas = await page.$(`#page-${n}`);
      const shot = await canvas.screenshot({ type: 'png' });
      ctx.pdfScreenshots.push(shot);
      log('screenshotAgent', `page ${n}/${pageMeta.length}: ${w}x${h}px (${shot.length} bytes)`);
    }

    // Stocker les dimensions réelles de la page 1
    if (pageMeta.length > 0 && ctx.pdfLayout) {
      ctx.pdfLayout.screenshotW = pageMeta[0].w;
      ctx.pdfLayout.screenshotH = pageMeta[0].h;
    }

    log('screenshotAgent', `${ctx.pdfScreenshots.length} page screenshots ready`);

  } catch (err) {
    error('screenshotAgent', err.message);
    ctx.warnings.push(`PDF screenshot failed: ${err.message}. Visual comparison skipped.`);
    ctx.pdfScreenshots = [];
  } finally {
    await browser.close();
  }

  return ctx;
}
