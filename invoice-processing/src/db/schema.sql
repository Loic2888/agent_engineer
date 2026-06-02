CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  issuer      TEXT    NOT NULL,
  address     TEXT,
  amount_due  REAL    NOT NULL,
  currency    TEXT    NOT NULL DEFAULT 'USD',
  due_date    TEXT    NOT NULL,
  file_name   TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
