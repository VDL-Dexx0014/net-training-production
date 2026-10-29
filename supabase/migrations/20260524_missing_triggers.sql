-- =====================================================================
-- Migration: Missing DB Triggers (P0 — must run on every new Supabase install)
-- Date: 2026-05-24
-- =====================================================================
-- These triggers existed in production but were never captured in
-- migrations. Without them, total_time_seconds and weight_kg are always
-- NULL and all time/weight data is silently incorrect.
-- =====================================================================

-- =====================================================================
-- TRIGGER 1: Compute total_time_seconds on machine_sessions
-- Fires after INSERT or UPDATE on machine_sessions when end_time is set.
-- =====================================================================

CREATE OR REPLACE FUNCTION compute_machine_session_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.total_time_seconds := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_compute_machine_session_time ON machine_sessions;

CREATE TRIGGER trigger_compute_machine_session_time
BEFORE INSERT OR UPDATE ON machine_sessions
FOR EACH ROW
EXECUTE FUNCTION compute_machine_session_time();

-- =====================================================================
-- TRIGGER 2: Compute weight_kg from weight_lbs on machine_sessions
-- Fires after INSERT or UPDATE when weight_lbs is set.
-- =====================================================================

CREATE OR REPLACE FUNCTION compute_machine_session_weight_kg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.weight_lbs IS NOT NULL THEN
    NEW.weight_kg := ROUND((NEW.weight_lbs * 0.453592)::NUMERIC, 2);
  ELSE
    NEW.weight_kg := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_compute_machine_session_weight ON machine_sessions;

CREATE TRIGGER trigger_compute_machine_session_weight
BEFORE INSERT OR UPDATE ON machine_sessions
FOR EACH ROW
EXECUTE FUNCTION compute_machine_session_weight_kg();

-- =====================================================================
-- TRIGGER 3: on_auth_user_created — create profiles row on signup
-- Fires after INSERT on auth.users.
-- =====================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    ARRAY[COALESCE(NEW.raw_user_meta_data->>'role', 'client')]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
