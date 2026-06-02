import { db } from './database.js';

export function insertInvoice({ issuer, address, amount_due, currency, due_date, file_name }) {
  const stmt = db.prepare(`
    INSERT INTO invoices (issuer, address, amount_due, currency, due_date, file_name)
    VALUES (@issuer, @address, @amount_due, @currency, @due_date, @file_name)
  `);
  const result = stmt.run({ issuer, address, amount_due, currency: currency || 'USD', due_date, file_name });
  return result.lastInsertRowid;
}

export function listInvoices() {
  return db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
}

export function getInvoiceById(id) {
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
}
