-- Enquiry follow-up status, separate from the clinical stage so nothing is lost when it is cleared:
-- NULL = normal; 'talking' = still in talks / deciding; 'hold' = on hold. While set, booking buttons are hidden.
ALTER TABLE patients ADD COLUMN hold_status TEXT;
