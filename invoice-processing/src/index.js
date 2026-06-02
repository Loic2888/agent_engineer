import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/database.js';
import uploadRouter from './routes/upload.js';
import invoicesRouter from './routes/invoices.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/invoices', uploadRouter);
app.use('/invoices', invoicesRouter);

initDb();

app.listen(PORT, () => {
  console.log(`Invoice Agent running on http://localhost:${PORT}`);
});
