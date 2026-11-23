-- Where each patient came from, and the day they first contacted the clinic (IST, YYYY-MM-DD).
-- Used for the monthly "where new patients came from" view on the dashboard.
-- source: one of the keys in src/sources.ts (e.g. 'google_ads'); NULL = not recorded.
ALTER TABLE patients ADD COLUMN source TEXT;
ALTER TABLE patients ADD COLUMN enquiry_date TEXT;
CREATE INDEX idx_patients_enquiry_date ON patients(enquiry_date);
