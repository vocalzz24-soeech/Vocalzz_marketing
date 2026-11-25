-- Conversation log with a patient / family (calls, WhatsApp chats, visits): what was said and when to contact them next.
-- The latest note is shown on the Patients list so staff can see where things stand without opening each patient.
CREATE TABLE patient_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  user_id INTEGER REFERENCES users(id),
  body TEXT NOT NULL,
  next_followup TEXT,                   -- YYYY-MM-DD (IST), optional: when to contact them next
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_patient_notes_patient ON patient_notes(patient_id, id);
