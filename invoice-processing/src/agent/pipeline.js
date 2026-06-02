import fs from 'fs';
import { convertToText } from './convert.js';
import { classify } from './classify.js';
import { extract } from './extract.js';
import { insertInvoice } from '../db/invoices.js';

export async function runPipeline(filePath, originalName) {
  try {
    // Step 1 — Convert
    const content = await convertToText(filePath);

    // Step 2 — Classify
    const isInvoice = await classify(content);
    if (!isInvoice) {
      return { status: 'skipped', reason: 'Document is not an invoice.' };
    }

    // Step 3 — Extract
    const fields = await extract(content);

    // Step 4 — Persist
    const invoice_id = insertInvoice({ ...fields, file_name: originalName });

    return { status: 'recorded', invoice_id, fields };
  } finally {
    // Always clean up the uploaded file
    fs.rmSync(filePath, { force: true });
  }
}
