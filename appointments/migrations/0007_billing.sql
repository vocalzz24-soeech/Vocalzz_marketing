-- Bills are snapshots: patient details are copied in, so a bill never changes after it is issued.
CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,          -- VZ/26-27/0001
  patient_id INTEGER REFERENCES patients(id),  -- NULL if the patient record is later deleted
  bill_date TEXT NOT NULL,              -- YYYY-MM-DD (IST)
  bill_to_name TEXT NOT NULL,
  bill_to_guardian TEXT,
  bill_to_phone TEXT,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  paid REAL NOT NULL DEFAULT 0,
  payment_mode TEXT,                    -- Cash, UPI, Card, Bank transfer, Other
  payment_ref TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cancelled_at TEXT,
  cancel_reason TEXT
);
CREATE INDEX idx_bills_patient ON bills(patient_id);
CREATE INDEX idx_bills_date ON bills(bill_date);

CREATE TABLE bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  position INTEGER NOT NULL,
  description TEXT NOT NULL,
  service TEXT,                         -- used to remember the last rate per therapy
  quantity REAL NOT NULL,
  rate REAL NOT NULL,
  amount REAL NOT NULL
);
CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
