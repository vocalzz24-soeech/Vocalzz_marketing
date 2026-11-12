-- Times are stored as UTC ISO strings (e.g. 2026-11-20T11:30:00.000Z).
CREATE TABLE therapists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,              -- 91XXXXXXXXXX
  specialty TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  guardian_name TEXT,               -- parent/guardian for children
  phone TEXT NOT NULL,              -- WhatsApp number, 91XXXXXXXXXX
  whatsapp_consent INTEGER NOT NULL DEFAULT 0,
  notes TEXT,                       -- admin notes only; no diagnoses
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_patients_phone ON patients(phone);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,       -- phone number used to log in
  role TEXT NOT NULL CHECK (role IN ('admin','therapist')),
  therapist_id INTEGER REFERENCES therapists(id),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  therapist_id INTEGER NOT NULL REFERENCES therapists(id),
  service TEXT NOT NULL,
  start_utc TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  extra_min INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked','cancelled','completed','no_show')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cancelled_at TEXT,
  cancel_reason TEXT,
  reminder_24h_sent_at TEXT,
  reminder_2h_sent_at TEXT
);
CREATE INDEX idx_appt_start ON appointments(start_utc);
CREATE INDEX idx_appt_therapist ON appointments(therapist_id, start_utc);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER REFERENCES appointments(id),
  recipient TEXT NOT NULL CHECK (recipient IN ('patient','therapist')),
  to_phone TEXT NOT NULL,
  kind TEXT NOT NULL,               -- confirmation, reminder_24h, reminder_2h, cancelled, rescheduled
  template TEXT NOT NULL,
  body_preview TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','dry_run','skipped')),
  provider_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_messages_appt ON messages(appointment_id);
