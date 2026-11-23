-- How the patient first reached out (WhatsApp, phone call, walk-in...), separate from where they heard about us.
-- contact_channel: one of the keys in CHANNELS in src/sources.ts; NULL = not recorded.
ALTER TABLE patients ADD COLUMN contact_channel TEXT;
