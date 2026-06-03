import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export function tempPath(ext) {
  return path.join(UPLOADS_DIR, `${randomUUID()}${ext}`);
}

export async function cleanup(...filePaths) {
  for (const fp of filePaths) {
    try {
      if (fp) await fs.unlink(fp);
    } catch {}
  }
}
