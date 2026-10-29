-- Add new client profile fields: high_risk, intensity, notes
-- Migration: 20260218_add_client_fields.sql

-- Add high_risk boolean column (default false)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS high_risk BOOLEAN DEFAULT false;

-- Add intensity enum column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intensity_level') THEN
    CREATE TYPE intensity_level AS ENUM ('extra_low', 'low', 'medium', 'high', 'extra_high');
  END IF;
END$$;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS intensity intensity_level DEFAULT NULL;

-- Add notes text column (separate from medical_notes for general trainer notes)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Add constraint: if high_risk is true, notes cannot be null
-- Note: This is handled in application logic, not database constraint
-- to allow for better UX (show validation error rather than DB error)

-- Add comments for documentation
COMMENT ON COLUMN profiles.high_risk IS 'Flag indicating if client is high risk and requires special attention';
COMMENT ON COLUMN profiles.intensity IS 'Preferred workout intensity level for this client';
COMMENT ON COLUMN profiles.notes IS 'General notes about the client (required when high_risk is true)';
