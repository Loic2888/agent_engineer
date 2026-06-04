import { createRequire } from 'module';
import { log, error } from '../utils/logger.js';

const require = createRequire(import.meta.url);

export async function runParserAgent(ctx) {
  log('parserAgent', 'extracting structured content from PDF');

  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ctx.files[0].buffer) }).promise;
    const layout = ctx.pdfLayout;
    const allItems = [];
    const pageDimensions = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      pageDimensions.push({ width: viewport.width, height: viewport.height });
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if (!item.str || !item.str.trim()) continue;
        allItems.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
          fontSize: Math.abs(item.transform[0]),
          page: pageNum,
        });
      }
    }

    // Données brutes positionnées — utilisées par le builderAgent (placement déterministe)
    ctx.positionedItems = allItems;
    ctx.pageDimensions = pageDimensions;

    if (allItems.length === 0) {
      ctx.warnings.push('No text found — PDF may be scanned (image-based). OCR is not supported.');
      ctx.emit?.('⚠️ No text found — PDF may be scanned');
      ctx.parsedText = '';
      ctx.structuredContent = null;
      return ctx;
    }
    ctx.emit?.(`📝 ${allItems.length} text elements extracted`);

    const headingThreshold = layout?.headingThreshold || 12;

    if (layout?.hasMultipleColumns) {
      const left = allItems.filter(i => i.x < layout.columnBoundary);
      const right = allItems.filter(i => i.x >= layout.columnBoundary);
      ctx.structuredContent = {
        type: 'two-column',
        leftColumnPct: layout.leftColumnRatio,
        leftColumn: buildSections(left, headingThreshold),
        rightColumn: buildSections(right, headingThreshold),
      };
    } else {
      ctx.structuredContent = {
        type: 'single-column',
        content: buildSections(allItems, headingThreshold),
      };
    }

    ctx.parsedText = allItems.map(i => i.text).join(' ');
    log('parserAgent', `${allItems.length} items, layout=${ctx.structuredContent.type}`);

  } catch (err) {
    error('parserAgent', `pdfjs failed (${err.message}), falling back to pdf-parse`);
    await fallbackParse(ctx);
  }

  return ctx;
}

function buildSections(items, headingThreshold) {
  // Trier par page, puis y décroissant (haut → bas), puis x croissant
  const sorted = [...items].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });

  // Regrouper en lignes (même y ± 3pt)
  const lines = [];
  let current = [];
  let lastY = null;
  let lastPage = null;

  for (const item of sorted) {
    if (lastPage === null || (item.page === lastPage && Math.abs(item.y - lastY) <= 3)) {
      current.push(item);
    } else {
      if (current.length) lines.push(current);
      current = [item];
    }
    lastY = item.y;
    lastPage = item.page;
  }
  if (current.length) lines.push(current);

  return lines
    .map(line => ({
      text: line.map(i => i.text).join(' '),
      isHeading: Math.max(...line.map(i => i.fontSize)) >= headingThreshold,
      fontSize: Math.max(...line.map(i => i.fontSize)),
    }))
    .filter(l => l.text.trim());
}

async function fallbackParse(ctx) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(ctx.files[0].buffer);
    ctx.plan.pageCount = data.numpages;
    ctx.parsedText = data.text;
    ctx.structuredContent = null;
    if (!data.text.trim()) {
      ctx.warnings.push('PDF appears scanned — OCR not supported.');
    }
    log('parserAgent', `fallback: pages=${data.numpages}, chars=${data.text.length}`);
  } catch (err) {
    error('parserAgent', err.message);
    ctx.errors.push(err.message);
  }
}
