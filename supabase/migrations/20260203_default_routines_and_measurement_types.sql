-- =====================================================================
-- Migration: Default Routines and Measurement Types
-- Date: 2026-02-03
-- =====================================================================
-- This migration adds:
-- 1. Support for default/template routines (nullable client_id)
-- 2. Measurement types table for workout data classification
-- =====================================================================

-- =====================================================================
-- PART 1: Default Routines Support
-- =====================================================================
-- Make client_id nullable to allow default/template routines
-- Default routines have client_id = NULL and can be copied to clients

ALTER TABLE programs
ALTER COLUMN client_id DROP NOT NULL;

-- Add is_default column to identify template routines
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Add index for default routines query
CREATE INDEX IF NOT EXISTS idx_programs_default
ON programs(is_default)
WHERE is_default = TRUE;

-- =====================================================================
-- PART 2: Update RLS Policies for Programs
-- =====================================================================
-- Update policies to handle both client programs and default routines

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS programs_select_policy ON programs;
DROP POLICY IF EXISTS programs_insert_policy ON programs;
DROP POLICY IF EXISTS programs_update_policy ON programs;
DROP POLICY IF EXISTS programs_delete_policy ON programs;

-- Create new policies that handle both client programs and default routines
CREATE POLICY programs_select_policy ON programs
FOR SELECT USING (
  -- Users can see their own programs (as client)
  auth.uid() = client_id
  -- Or trainers/management can see all programs
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (roles @> ARRAY['trainer'] OR roles @> ARRAY['management'])
  )
  -- Or anyone authenticated can see default routines
  OR (is_default = TRUE AND auth.uid() IS NOT NULL)
);

CREATE POLICY programs_insert_policy ON programs
FOR INSERT WITH CHECK (
  -- Trainers/management can insert
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (roles @> ARRAY['trainer'] OR roles @> ARRAY['management'])
  )
);

CREATE POLICY programs_update_policy ON programs
FOR UPDATE USING (
  -- Trainers/management can update
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (roles @> ARRAY['trainer'] OR roles @> ARRAY['management'])
  )
);

CREATE POLICY programs_delete_policy ON programs
FOR DELETE USING (
  -- Only management can delete
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles @> ARRAY['management']
  )
);

-- =====================================================================
-- PART 3: Measurement Types Table
-- =====================================================================
-- Tracks different workout measurement methodologies
-- Each type defines what units of data are collected

CREATE TABLE IF NOT EXISTS measurement_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  abbreviation VARCHAR(20) NOT NULL,
  units JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(abbreviation)
);

-- Create index for active measurement types
CREATE INDEX IF NOT EXISTS idx_measurement_types_active
ON measurement_types(is_active)
WHERE is_active = TRUE;

-- =====================================================================
-- PART 4: Seed Default Measurement Types
-- =====================================================================

INSERT INTO measurement_types (name, abbreviation, units, description, is_active, is_custom) VALUES
  ('Time Under Load', 'TUL', '["weight", "time"]', 'Measures the total time muscle is under tension with a given weight', TRUE, FALSE),
  ('Static Hold', 'SH', '["weight", "time"]', 'Isometric hold at a specific position with weight', TRUE, FALSE),
  ('Negative', 'N', '["weight", "time", "reps"]', 'Eccentric-focused training with controlled lowering phase', TRUE, FALSE),
  ('Rep', 'R', '["weight", "reps"]', 'Traditional repetition-based training', TRUE, FALSE),
  ('10-10-10', '10', '["weight", "time"]', '10 second positive, 10 second hold, 10 second negative protocol', TRUE, FALSE)
ON CONFLICT (abbreviation) DO NOTHING;

-- =====================================================================
-- PART 5: RLS Policies for Measurement Types
-- =====================================================================

ALTER TABLE measurement_types ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read measurement types
CREATE POLICY measurement_types_select_policy ON measurement_types
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only management can insert
CREATE POLICY measurement_types_insert_policy ON measurement_types
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles @> ARRAY['management']
  )
);

-- Only management can update
CREATE POLICY measurement_types_update_policy ON measurement_types
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles @> ARRAY['management']
  )
);

-- Only management can delete, and only custom types
CREATE POLICY measurement_types_delete_policy ON measurement_types
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles @> ARRAY['management']
  )
  AND is_custom = TRUE
);

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
