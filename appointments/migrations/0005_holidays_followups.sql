-- Days the clinic is closed (IST calendar days, "YYYY-MM-DD").
CREATE TABLE holidays (
  day TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- When the clinic last followed up a patient about missed sessions.
ALTER TABLE patients ADD COLUMN followed_up_at TEXT;
