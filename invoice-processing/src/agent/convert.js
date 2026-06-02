import fs from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export async function convertToText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = filePath.split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    const data = await pdfParse(buffer);
    return `# Extracted invoice text\n\n${data.text.trim()}`;
  }

  // For images, return a base64 marker that extract.js will handle via vision
  const base64 = buffer.toString('base64');
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return JSON.stringify({ __image__: true, base64, mime });
}
