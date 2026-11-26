-- Optional time for the next follow-up (HH:MM, IST), next to next_followup.
ALTER TABLE patient_notes ADD COLUMN next_followup_time TEXT;
