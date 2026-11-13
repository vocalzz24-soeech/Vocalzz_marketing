-- Weekly repeating sessions: appointments created together share a series_id.
ALTER TABLE appointments ADD COLUMN series_id TEXT;
CREATE INDEX idx_appt_series ON appointments(series_id);
