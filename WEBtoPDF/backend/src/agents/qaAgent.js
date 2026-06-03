import fs from 'fs/promises';
import { log, error } from '../utils/logger.js';

export async function runQaAgent(ctx) {
  log('qaAgent', 'validating PDF');

  if (!ctx.outputPath) {
    ctx.errors.push('No PDF output to validate.');
    ctx.qaPass = false;
    return ctx;
  }

  try {
    const stat = await fs.stat(ctx.outputPath);
    if (stat.size < 1000) {
      ctx.errors.push('PDF appears empty (file too small).');
      ctx.qaPass = false;
      return ctx;
    }
    ctx.qaPass = true;
    log('qaAgent', `PDF OK, size=${stat.size} bytes`);
  } catch (err) {
    error('qaAgent', err.message);
    ctx.errors.push(err.message);
    ctx.qaPass = false;
  }

  return ctx;
}
