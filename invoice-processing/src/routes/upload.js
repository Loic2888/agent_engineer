import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { runPipeline } from '../agent/pipeline.js';

const router = express.Router();

const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_SIZE_MB = 20;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync('./uploads', { recursive: true });
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const result = await runPipeline(req.file.path, req.file.originalname);
    res.json(result);
  } catch (err) {
    console.error('Pipeline error:', err);
    res.status(422).json({ error: err.message || 'Processing failed.' });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `File too large (max ${MAX_SIZE_MB} MB).` });
  }
  res.status(400).json({ error: err.message });
});

export default router;
