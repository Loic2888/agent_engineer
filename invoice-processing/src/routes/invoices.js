import express from 'express';
import { listInvoices, getInvoiceById } from '../db/invoices.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(listInvoices());
});

router.get('/:id', (req, res) => {
  const invoice = getInvoiceById(Number(req.params.id));
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
  res.json(invoice);
});

export default router;
