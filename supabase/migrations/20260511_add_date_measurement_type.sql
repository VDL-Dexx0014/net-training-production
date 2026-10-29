-- Add "Date" measurement type
-- Stored as reps = 1 (done) / 0 (not done). Rendered in UI as a tick mark.
-- units = ['date'] is the sentinel that tells the UI to render a checkbox, not numeric fields.

INSERT INTO measurement_types (name, abbreviation, units, is_active, is_custom, sort_order)
VALUES ('Date', 'DATE', ARRAY['date'], true, false, 99)
ON CONFLICT (abbreviation) DO NOTHING;
