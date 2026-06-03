import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './router.js';
import { ensureUploadsDir } from './utils/fileHelpers.js';
import { log } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
// Expose pdfjs-dist browser build so screenshotAgent can load it from Puppeteer
app.use('/pdfjs', express.static(path.join(process.cwd(), 'node_modules/pdfjs-dist')));
app.use(router);

await ensureUploadsDir();

app.listen(PORT, () => {
  log('server', `listening on http://localhost:${PORT}`);
});
