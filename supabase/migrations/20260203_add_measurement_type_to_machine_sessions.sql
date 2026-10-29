-- =====================================================================
-- Migration: Add Measurement Type to Machine Sessions
-- Date: 2026-02-03
-- =====================================================================
-- This migration adds measurement_type_id to machine_sessions table
-- to allow trainers to select a measurement type when recording workouts
-- =====================================================================

-- Add measurement_type_id column to machine_sessions
ALTER TABLE machine_sessions
ADD COLUMN IF NOT EXISTS measurement_type_id UUID REFERENCES measurement_types(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_machine_sessions_measurement_type
ON machine_sessions(measurement_type_id)
WHERE measurement_type_id IS NOT NULL;

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
