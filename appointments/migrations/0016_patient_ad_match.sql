-- Which Google ad click most likely brought a patient (matched by the time they contacted us).
ALTER TABLE patients ADD COLUMN enquiry_time TEXT;    -- HH:MM (IST) when they first contacted us
ALTER TABLE patients ADD COLUMN ad_group TEXT;        -- Google Ads ad group name, e.g. "Adults"
ALTER TABLE patients ADD COLUMN ad_click_type TEXT;   -- Google click type, e.g. CALLS, URL_CLICKS, LOCATION_EXPANSION
ALTER TABLE patients ADD COLUMN ad_match TEXT;        -- 'likely' (matched by time) or 'confirmed' (patient said so)
