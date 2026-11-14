-- Staff policy documents (PDF, stored base64 so they are only reachable through the logged-in app).
CREATE TABLE policy_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  data_b64 TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at TEXT                    -- set when replaced by a newer version or removed
);
CREATE INDEX idx_policy_docs_title ON policy_docs(title);

CREATE TABLE policy_acks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL REFERENCES policy_docs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  acked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (doc_id, user_id)
);
