import { createRequire } from 'module';
import { log } from '../utils/logger.js';

const require = createRequire(import.meta.url);

export async function runPlanningAgent(ctx) {
  log('planningAgent', `mode=${ctx.mode}, files=${ctx.files.length}`);
  ctx.emit?.('📋 Analyzing PDF structure...');

  if (ctx.mode === 'html-to-pdf') {
    const htmlFiles = ctx.files.filter(f => f.originalname.endsWith('.html'));
    const cssFiles = ctx.files.filter(f => f.originalname.endsWith('.css'));
    if (htmlFiles.length === 0) ctx.errors.push('No .html file found in upload.');
    ctx.plan = { htmlFiles, cssFiles };
    log('planningAgent', `found ${htmlFiles.length} HTML, ${cssFiles.length} CSS`);
    return ctx;
  }

  // PDF → HTML: analyse la structure visuelle de la première page
  ctx.plan = { pageCount: null, hasImages: false };

  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ctx.files[0].buffer) }).promise;
    ctx.plan.pageCount = pdf.numPages;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const pageWidth = viewport.width;

    const items = textContent.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({
        text: i.str.trim(),
        x: i.transform[4],
        y: i.transform[5],
        fontSize: Math.abs(i.transform[0]),
      }));

    // Détecter les colonnes : chercher un grand vide horizontal dans les positions x
    const xValues = [...new Set(items.map(i => Math.round(i.x / 5) * 5))].sort((a, b) => a - b);
    let maxGap = 0;
    let columnBoundary = pageWidth / 2;
    let hasMultipleColumns = false;

    for (let i = 0; i < xValues.length - 1; i++) {
      const gap = xValues[i + 1] - xValues[i];
      if (gap > maxGap) {
        maxGap = gap;
        columnBoundary = (xValues[i] + xValues[i + 1]) / 2;
      }
    }

    // Valider que la frontière est dans une zone raisonnable (15%–85% de la largeur)
    if (maxGap > 80 && columnBoundary > pageWidth * 0.15 && columnBoundary < pageWidth * 0.85) {
      hasMultipleColumns = true;
    }

    // Seuil pour détecter les titres (police > 1.4x la moyenne)
    const fontSizes = items.map(i => i.fontSize).filter(s => s > 0);
    const avgFontSize = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length || 10;

    ctx.pdfLayout = {
      pageWidth,
      pageHeight: viewport.height,
      hasMultipleColumns,
      columnBoundary,
      leftColumnRatio: hasMultipleColumns ? Math.round((columnBoundary / pageWidth) * 100) : 100,
      headingThreshold: avgFontSize * 1.4,
    };

    ctx.emit?.(`📋 ${pdf.numPages} page(s) — ${hasMultipleColumns ? '2-column layout' : 'single column'}`);
    log('planningAgent',
      `pages=${pdf.numPages}, cols=${hasMultipleColumns ? 2 : 1}, boundary=${columnBoundary.toFixed(0)}/${pageWidth.toFixed(0)}, headingThreshold=${ctx.pdfLayout.headingThreshold.toFixed(1)}`
    );
  } catch (err) {
    log('planningAgent', `visual analysis failed (${err.message}), will rely on text only`);
    ctx.pdfLayout = null;
  }

  return ctx;
}
