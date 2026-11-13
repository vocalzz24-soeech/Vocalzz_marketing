-- When a message was sent by hand from the admin's own WhatsApp (one-tap wa.me link).
ALTER TABLE messages ADD COLUMN manual_sent_at TEXT;
