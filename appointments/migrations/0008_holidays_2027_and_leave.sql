-- 2027 clinic holidays from the Vocalzz Holiday Calendar 2027 (Eid dates may move by a day: edit on the Holidays page).
INSERT OR IGNORE INTO holidays (day, name) VALUES
  ('2027-01-14', 'Makar Sankranti'), ('2027-01-26', 'Republic Day'), ('2027-03-10', 'Id-ul-Fitr (Eid)'),
  ('2027-03-23', 'Holi'), ('2027-04-15', 'Ram Navami'), ('2027-05-17', 'Id-ul-Zuha (Bakrid)'),
  ('2027-08-15', 'Independence Day'), ('2027-08-17', 'Raksha Bandhan'), ('2027-08-25', 'Janmashtami'),
  ('2027-10-02', 'Gandhi Jayanti'), ('2027-10-09', 'Dussehra'), ('2027-10-29', 'Diwali'),
  ('2027-10-31', 'Bhai Dooj'), ('2027-12-25', 'Christmas');

-- Staff leave (HR Policy 2027): joining date and an opening balance for each therapist, plus leave requests.
ALTER TABLE therapists ADD COLUMN joined_on TEXT;
ALTER TABLE therapists ADD COLUMN leave_opening REAL NOT NULL DEFAULT 0;

CREATE TABLE leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id),
  start_day TEXT NOT NULL,
  end_day TEXT NOT NULL,
  days REAL NOT NULL,                      -- working days (Mon-Sat, excluding clinic holidays)
  kind TEXT NOT NULL CHECK (kind IN ('planned', 'emergency')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  short_notice INTEGER NOT NULL DEFAULT 0, -- requested with less notice than the policy asks
  requested_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  decision_note TEXT
);
CREATE INDEX idx_leave_therapist ON leave_requests(therapist_id, start_day);
