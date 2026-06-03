import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { runOrchestrator } from './agents/orchestrator.js';
import { log } from './utils/logger.js';
import { UPLOADS_DIR } from './utils/fileHelpers.js';
import { createJob, emitMessage, finishJob, failJob, addClient, removeClient } from './utils/jobStore.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── POST /convert — démarre le job en arrière-plan, renvoie jobId immédiatement
router.post('/convert', upload.array('files'), async (req, res) => {
  const mode = req.query.mode;
  if (!['html-to-pdf', 'pdf-to-html'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'Invalid mode.' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded.' });
  }

  const jobId = randomUUID();
  createJob(jobId);
  res.json({ jobId });

  log('router', `job ${jobId} started mode=${mode}`);
  processJob(jobId, req.files, mode);
});

// ── GET /status/:jobId — SSE stream du job
router.get('/status/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { jobId } = req.params;
  if (!addClient(jobId, res)) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Job not found' })}\n\n`);
    res.end();
    return;
  }

  req.on('close', () => removeClient(jobId, res));
});

// ── GET /download/:filename
router.get('/download/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  try {
    await fs.access(filePath);
    res.download(filePath);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Traitement effectif du job
async function processJob(jobId, files, mode) {
  const emit = (msg) => emitMessage(jobId, msg);

  try {
    const ctx = await runOrchestrator(files, mode, emit);

    if (!ctx.output) {
      return failJob(jobId, ctx.errors.join('\n') || 'Conversion failed.');
    }

    const fileId = randomUUID();

    if (ctx.output.type === 'pdf') {
      const destPath = path.join(UPLOADS_DIR, `${fileId}.pdf`);
      await fs.rename(ctx.output.path, destPath);
      finishJob(jobId, {
        success: true,
        outputFile: 'result.pdf',
        downloadUrls: [`/download/${fileId}.pdf`],
        outputFiles: ['result.pdf'],
        warnings: ctx.warnings,
        attempts: ctx.attempt + 1,
        score: ctx.validatorScore ?? null,
      });

    } else {
      // Injecter CSS inline pour que le HTML soit autonome
      let finalHtml = ctx.output.html;
      const styleTag = `<style>\n${ctx.output.css}\n</style>`;
      finalHtml = finalHtml.includes('</head>')
        ? finalHtml.replace('</head>', `${styleTag}\n</head>`)
        : styleTag + '\n' + finalHtml;

      const htmlPath = path.join(UPLOADS_DIR, `${fileId}.html`);
      const cssPath = path.join(UPLOADS_DIR, `${fileId}.css`);
      await fs.writeFile(htmlPath, finalHtml);
      await fs.writeFile(cssPath, ctx.output.css);

      finishJob(jobId, {
        success: true,
        outputFiles: ['result.html', 'result.css'],
        downloadUrls: [`/download/${fileId}.html`, `/download/${fileId}.css`],
        warnings: ctx.warnings,
        attempts: ctx.attempt + 1,
        score: ctx.validatorScore ?? null,
      });
    }

  } catch (err) {
    log('router', `job ${jobId} failed: ${err.message}`);
    failJob(jobId, err.message);
  }
}

export default router;
