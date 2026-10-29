-- =====================================================================
-- WORKOUT-ONLY VERSION: Database Migration
-- =====================================================================
-- Purpose: Simplify database schema for workout-only version
-- Removes: Scheduling columns, availability tables
-- Keeps: Workout tracking, programs, machine sessions
-- =====================================================================

-- =====================================================================
-- STEP 1: Simplify Sessions Table
-- =====================================================================
-- Remove scheduled_start and scheduled_end columns
-- Sessions now only use actual_start and actual_end
-- Sessions are created on-demand (no pre-booking)

ALTER TABLE sessions
DROP COLUMN IF EXISTS scheduled_start,
DROP COLUMN IF EXISTS scheduled_end;

-- Ensure actual_start and actual_end exist
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ;

-- Update status enum to only include relevant values for workout-only
-- 'scheduled' is no longer used - sessions are either 'in_progress' or 'completed'
-- Keep cancelled for historical data
COMMENT ON COLUMN sessions.status IS 'Status: in_progress (workout active), completed (finished), cancelled (not used)';

-- Add convenience columns for workout-only metrics
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER GENERATED ALWAYS AS (
  CASE
    WHEN actual_start IS NOT NULL AND actual_end IS NOT NULL
    THEN EXTRACT(EPOCH FROM (actual_end - actual_start)) / 60
    ELSE NULL
  END
) STORED,
ADD COLUMN IF NOT EXISTS completed_exercises INTEGER;

COMMENT ON COLUMN sessions.duration_minutes IS 'Automatically calculated from actual_start and actual_end';
COMMENT ON COLUMN sessions.completed_exercises IS 'Number of machine exercises completed in this session';

-- =====================================================================
-- STEP 2: Drop Scheduling Tables (Optional - Keep for Migration Path)
-- =====================================================================
-- These tables are not used in workout-only version
-- ONLY DROP if you want a completely clean schema
-- Comment out if you want to preserve data for potential migration back

-- DROP TABLE IF EXISTS trainer_availability CASCADE;
-- COMMENT: We're keeping this table for now in case gyms want to migrate
-- back to full version. It won't be used by workout-only code.

-- =====================================================================
-- STEP 3: Simplify Trainer-Client Relationship
-- =====================================================================
-- Keep trainer_clients table - still needed for workout-only
-- Trainers need to know which clients they work with

-- No changes needed to trainer_clients table
-- It's still used to establish trainer-client relationships

-- =====================================================================
-- STEP 4: Update Indexes for Workout-Only Queries
-- =====================================================================

-- Add index on actual_start for performance (most common query in workout-only)
CREATE INDEX IF NOT EXISTS idx_sessions_actual_start
ON sessions(trainer_id, actual_start DESC)
WHERE actual_start IS NOT NULL;

-- Add index for client recent sessions query
CREATE INDEX IF NOT EXISTS idx_sessions_client_actual_start
ON sessions(client_id, actual_start DESC)
WHERE actual_start IS NOT NULL;

-- Add index for completed sessions count
CREATE INDEX IF NOT EXISTS idx_sessions_completed
ON sessions(trainer_id, status)
WHERE status = 'completed';

-- Drop old scheduled_start indexes (if they exist from full version)
DROP INDEX IF EXISTS idx_sessions_scheduled_start;
DROP INDEX IF EXISTS idx_sessions_trainer_scheduled;

-- =====================================================================
-- STEP 5: Update Row Level Security Policies
-- =====================================================================

-- Sessions RLS policies remain mostly the same
-- Just ensure they work with actual_start instead of scheduled_start

-- No changes needed - existing RLS works fine

-- =====================================================================
-- STEP 6: Data Migration from Full Version (If Applicable)
-- =====================================================================
-- If migrating from full version to workout-only:

-- Update in-progress sessions (remove scheduled times)
UPDATE sessions
SET scheduled_start = NULL,
    scheduled_end = NULL
WHERE status = 'scheduled'
  AND actual_start IS NULL;

-- Cancel future scheduled sessions (they can't exist in workout-only)
UPDATE sessions
SET status = 'cancelled',
    trainer_notes = COALESCE(trainer_notes || ' | ', '') || 'Cancelled during migration to workout-only version'
WHERE status = 'scheduled'
  AND actual_start IS NULL
  AND scheduled_start > NOW();

-- Keep completed sessions (they have actual times)
-- No changes needed for completed sessions

-- =====================================================================
-- STEP 7: Update Functions/Triggers (If Any)
-- =====================================================================

-- Add trigger to auto-calculate completed_exercises
-- (This would be updated when machine_sessions are inserted)

CREATE OR REPLACE FUNCTION update_session_exercise_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions
  SET completed_exercises = (
    SELECT COUNT(*)
    FROM machine_sessions
    WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
  )
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_exercise_count ON machine_sessions;

CREATE TRIGGER trigger_update_exercise_count
AFTER INSERT OR UPDATE OR DELETE ON machine_sessions
FOR EACH ROW
EXECUTE FUNCTION update_session_exercise_count();

-- =====================================================================
-- STEP 8: Create View for Workout-Only Dashboard
-- =====================================================================

-- Convenient view for trainer dashboard (shows recent sessions with details)
CREATE OR REPLACE VIEW trainer_recent_sessions AS
SELECT
  s.id,
  s.trainer_id,
  s.client_id,
  s.program_id,
  s.actual_start,
  s.actual_end,
  s.duration_minutes,
  s.completed_exercises,
  s.status,
  c.first_name AS client_first_name,
  c.last_name AS client_last_name,
  c.email AS client_email,
  p.name AS program_name,
  p.description AS program_description
FROM sessions s
JOIN profiles c ON s.client_id = c.id
LEFT JOIN programs p ON s.program_id = p.id
WHERE s.status = 'completed'
  AND s.actual_start >= NOW() - INTERVAL '30 days'
ORDER BY s.actual_start DESC;

-- Grant access to trainers
GRANT SELECT ON trainer_recent_sessions TO authenticated;

-- RLS for view (show only trainer's own sessions)
CREATE POLICY trainer_view_own_sessions ON trainer_recent_sessions
FOR SELECT
USING (
  auth.uid() = trainer_id
  OR auth.uid() = client_id
);

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify migration success:

-- Check sessions table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'sessions'
-- ORDER BY ordinal_position;

-- Check for any remaining scheduled sessions (should be 0 or cancelled)
-- SELECT COUNT(*), status
-- FROM sessions
-- WHERE scheduled_start IS NOT NULL
-- GROUP BY status;

-- Verify indexes exist
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'sessions';

-- =====================================================================
-- ROLLBACK INSTRUCTIONS (If Needed)
-- =====================================================================
-- To rollback this migration:

-- 1. Re-add scheduled columns:
-- ALTER TABLE sessions
-- ADD COLUMN scheduled_start TIMESTAMPTZ,
-- ADD COLUMN scheduled_end TIMESTAMPTZ;

-- 2. Restore trainer_availability table (if dropped)
-- (Restore from backup)

-- 3. Drop workout-only specific columns:
-- ALTER TABLE sessions
-- DROP COLUMN duration_minutes,
-- DROP COLUMN completed_exercises;

-- 4. Drop view:
-- DROP VIEW IF EXISTS trainer_recent_sessions;

-- =====================================================================
-- NOTES FOR DEPLOYMENT
-- =====================================================================
-- 1. Test on UAT database first
-- 2. Backup production database before running
-- 3. Run during low-traffic period
-- 4. Verify all sessions have actual_start/actual_end before dropping scheduled columns
-- 5. Monitor application logs after deployment

-- =====================================================================
-- STEP 9: Default Routines Support
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

-- Update RLS policy to allow management to view/edit default routines
-- (Default routines have no client_id, so normal RLS won't work)

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
-- STEP 10: Measurement Types Table
-- =====================================================================
-- Tracks different workout measurement methodologies

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

-- Insert default measurement types
INSERT INTO measurement_types (name, abbreviation, units, description, is_active, is_custom) VALUES
  ('Time Under Load', 'TUL', '["weight", "time"]', 'Measures the total time muscle is under tension with a given weight', TRUE, FALSE),
  ('Static Hold', 'SH', '["weight", "time"]', 'Isometric hold at a specific position with weight', TRUE, FALSE),
  ('Negative', 'N', '["weight", "time", "reps"]', 'Eccentric-focused training with controlled lowering phase', TRUE, FALSE),
  ('Rep', 'R', '["weight", "reps"]', 'Traditional repetition-based training', TRUE, FALSE),
  ('10-10-10', '10', '["weight", "time"]', '10 second positive, 10 second hold, 10 second negative protocol', TRUE, FALSE)
ON CONFLICT (abbreviation) DO NOTHING;

-- RLS policies for measurement_types
ALTER TABLE measurement_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY measurement_types_select_policy ON measurement_types
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY measurement_types_insert_policy ON measurement_types
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles @> ARRAY['management']
  )
);

CREATE POLICY measurement_types_update_policy ON measurement_types
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles @> ARRAY['management']
  )
);

CREATE POLICY measurement_types_delete_policy ON measurement_types
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles @> ARRAY['management']
  )
  AND is_custom = TRUE  -- Only allow deleting custom types
);

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
