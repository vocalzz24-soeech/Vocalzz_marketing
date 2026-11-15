-- New patients start with a consultation. Regular sessions open up once it is confirmed.
-- stage: 'consultation' = new patient, consultation not yet confirmed
--        'active'       = consultation confirmed (or an existing patient): sessions can be booked
--        'closed'       = did not go ahead after the consultation
ALTER TABLE patients ADD COLUMN stage TEXT NOT NULL DEFAULT 'active';
ALTER TABLE patients ADD COLUMN stage_changed_at TEXT;
