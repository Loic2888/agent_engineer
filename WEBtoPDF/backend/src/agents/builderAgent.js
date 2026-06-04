import { log } from '../utils/logger.js';

// Builder déterministe : place chaque morceau de texte du PDF à sa position
// exacte (x/y/fontSize) en HTML absolu. Aucun LLM, aucune perte de texte —
// le placement vient directement des coordonnées extraites par le parserAgent.
export async function runBuilderAgent(ctx) {
  const items = ctx.positionedItems || [];
  const dims = ctx.pageDimensions || [];

  if (items.length === 0 || dims.length === 0) {
    ctx.errors.push('builderAgent: no positioned text available to build the page.');
    return ctx;
  }

  // Seuil titre : 1.4× la taille de police moyenne (ou valeur du planningAgent)
  const fontSizes = items.map(i => i.fontSize).filter(s => s > 0);
  const avg = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length || 10;
  const headingThreshold = ctx.pdfLayout?.headingThreshold || avg * 1.4;

  const pages = dims.map((d, idx) => {
    const pageItems = items.filter(i => i.page === idx + 1);
    const spans = pageItems.map(it => {
      const left = it.x.toFixed(1);
      // PDF : origine en bas à gauche, y = ligne de base → conversion vers le haut
      const top = (d.height - it.y - it.fontSize).toFixed(1);
      const fs = it.fontSize.toFixed(1);
      const weight = it.fontSize >= headingThreshold ? ' font-weight:600;' : '';
      return `    <span class="t" style="left:${left}px;top:${top}px;font-size:${fs}px;${weight}">${escapeHtml(it.text)}</span>`;
    }).join('\n');
    return `  <div class="page" style="width:${d.width.toFixed(0)}px;height:${d.height.toFixed(0)}px;">\n${spans}\n  </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
</head>
<body>
${pages}
</body>
</html>`;

  // NB : page 1 collée à l'origine (0,0) pour s'aligner sur le clip du validatorAgent.
  // L'espacement entre pages n'est appliqué qu'à partir de la 2e page.
  const css = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #525659; }
.page {
  position: relative;
  background: #ffffff;
  margin: 0 auto;
  overflow: hidden;
  font-family: Helvetica, Arial, sans-serif;
  color: #1a1a1a;
}
.page + .page { margin-top: 20px; }
.t {
  position: absolute;
  white-space: pre;
  line-height: 1;
}`;

  ctx.outputHtml = html;
  ctx.outputCss = css;
  // Dimensions de la page 1 — utilisées par le validatorAgent pour le viewport
  ctx.pageW = Math.round(dims[0].width);
  ctx.pageH = Math.round(dims[0].height);

  ctx.emit?.(`🧱 Page built — ${items.length} text elements placed at exact positions`);
  log('builderAgent', `${dims.length} page(s), ${items.length} spans, page1=${ctx.pageW}x${ctx.pageH}`);

  return ctx;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
