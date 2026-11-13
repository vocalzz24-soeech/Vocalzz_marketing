-- Deleted therapists are anonymised (name/phone/login cleared) but kept so patients' past sessions stay intact.
ALTER TABLE therapists ADD COLUMN deleted_at TEXT;
