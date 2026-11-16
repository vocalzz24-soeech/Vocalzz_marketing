-- Log of report emails (weekly Sunday report and "Email me this report"), so the admin can see they went out.
CREATE TABLE report_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,               -- weekly, on_demand
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','not_configured')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
