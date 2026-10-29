-- =====================================================================
-- Fix: RLS infinite recursion on profiles table
-- =====================================================================
-- The original policies used `EXISTS (SELECT 1 FROM profiles WHERE ...)`
-- inside policies on OTHER tables. When PostgreSQL evaluates those policies
-- it reads profiles, which triggers profiles' own RLS policies, which query
-- profiles again → infinite recursion (error 42P17).
--
-- Fix: two SECURITY DEFINER helper functions that read profiles bypassing
-- RLS, then all policies call these functions instead of querying profiles
-- directly.
-- =====================================================================

-- Step 1: helper functions (SECURITY DEFINER = run as function owner, bypasses RLS)
CREATE OR REPLACE FUNCTION auth_has_role(required_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND roles @> ARRAY[required_role]
  )
$$;

CREATE OR REPLACE FUNCTION auth_has_any_role(required_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND roles && required_roles
  )
$$;

-- Step 2: drop and recreate all policies that queried profiles directly

-- ---- profiles ----
DROP POLICY IF EXISTS profiles_manage ON profiles;
CREATE POLICY profiles_manage ON profiles FOR ALL USING (auth_has_role('management'));

-- ---- locations ----
DROP POLICY IF EXISTS locations_manage ON locations;
CREATE POLICY locations_manage ON locations FOR ALL USING (auth_has_role('management'));

-- ---- trainer_locations ----
DROP POLICY IF EXISTS trainer_locations_manage ON trainer_locations;
CREATE POLICY trainer_locations_manage ON trainer_locations FOR ALL USING (auth_has_role('management'));

-- ---- trainer_clients ----
DROP POLICY IF EXISTS trainer_clients_select ON trainer_clients;
DROP POLICY IF EXISTS trainer_clients_manage ON trainer_clients;
CREATE POLICY trainer_clients_select ON trainer_clients FOR SELECT USING (
  trainer_id = auth.uid() OR client_id = auth.uid() OR auth_has_role('management')
);
CREATE POLICY trainer_clients_manage ON trainer_clients FOR ALL USING (
  trainer_id = auth.uid() OR auth_has_role('management')
);

-- ---- machines ----
DROP POLICY IF EXISTS machines_manage ON machines;
CREATE POLICY machines_manage ON machines FOR ALL USING (auth_has_role('management'));

-- ---- machine_locations ----
DROP POLICY IF EXISTS machine_locations_manage ON machine_locations;
CREATE POLICY machine_locations_manage ON machine_locations FOR ALL USING (auth_has_role('management'));

-- ---- measurement_types ----
DROP POLICY IF EXISTS measurement_types_manage ON measurement_types;
CREATE POLICY measurement_types_manage ON measurement_types FOR ALL USING (auth_has_role('management'));

-- ---- programs ----
DROP POLICY IF EXISTS programs_select ON programs;
DROP POLICY IF EXISTS programs_insert ON programs;
DROP POLICY IF EXISTS programs_update ON programs;
DROP POLICY IF EXISTS programs_delete ON programs;
CREATE POLICY programs_select ON programs FOR SELECT USING (
  client_id = auth.uid() OR is_default = TRUE OR auth_has_any_role(ARRAY['trainer','management'])
);
CREATE POLICY programs_insert ON programs FOR INSERT WITH CHECK (
  auth_has_any_role(ARRAY['trainer','management'])
);
CREATE POLICY programs_update ON programs FOR UPDATE USING (
  auth_has_any_role(ARRAY['trainer','management'])
);
CREATE POLICY programs_delete ON programs FOR DELETE USING (auth_has_role('management'));

-- ---- program_machines ----
DROP POLICY IF EXISTS program_machines_select ON program_machines;
DROP POLICY IF EXISTS program_machines_manage ON program_machines;
CREATE POLICY program_machines_select ON program_machines FOR SELECT USING (
  auth_has_any_role(ARRAY['trainer','management','client'])
);
CREATE POLICY program_machines_manage ON program_machines FOR ALL USING (
  auth_has_any_role(ARRAY['trainer','management'])
);

-- ---- sessions ----
DROP POLICY IF EXISTS sessions_select ON sessions;
DROP POLICY IF EXISTS sessions_insert ON sessions;
DROP POLICY IF EXISTS sessions_update ON sessions;
DROP POLICY IF EXISTS sessions_delete ON sessions;
CREATE POLICY sessions_select ON sessions FOR SELECT USING (
  trainer_id = auth.uid() OR client_id = auth.uid() OR auth_has_role('management')
);
CREATE POLICY sessions_insert ON sessions FOR INSERT WITH CHECK (
  trainer_id = auth.uid() AND auth_has_role('trainer')
);
CREATE POLICY sessions_update ON sessions FOR UPDATE USING (
  trainer_id = auth.uid() OR auth_has_role('management')
);
CREATE POLICY sessions_delete ON sessions FOR DELETE USING (
  trainer_id = auth.uid() OR auth_has_role('management')
);

-- ---- machine_sessions ----
DROP POLICY IF EXISTS machine_sessions_select ON machine_sessions;
DROP POLICY IF EXISTS machine_sessions_update ON machine_sessions;
DROP POLICY IF EXISTS machine_sessions_delete ON machine_sessions;
CREATE POLICY machine_sessions_select ON machine_sessions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = session_id AND (s.trainer_id = auth.uid() OR s.client_id = auth.uid())
  )
  OR auth_has_role('management')
);
CREATE POLICY machine_sessions_update ON machine_sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_id AND s.trainer_id = auth.uid())
  OR auth_has_role('management')
);
CREATE POLICY machine_sessions_delete ON machine_sessions FOR DELETE USING (
  EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_id AND s.trainer_id = auth.uid())
  OR auth_has_role('management')
);

-- ---- user_machine_settings ----
DROP POLICY IF EXISTS user_machine_settings_select ON user_machine_settings;
DROP POLICY IF EXISTS user_machine_settings_manage ON user_machine_settings;
CREATE POLICY user_machine_settings_select ON user_machine_settings FOR SELECT USING (
  user_id = auth.uid() OR auth_has_any_role(ARRAY['trainer','management'])
);
CREATE POLICY user_machine_settings_manage ON user_machine_settings FOR ALL USING (
  auth_has_any_role(ARRAY['trainer','management'])
);

-- ---- machine_attribute_definitions ----
DROP POLICY IF EXISTS attr_defs_manage ON machine_attribute_definitions;
CREATE POLICY attr_defs_manage ON machine_attribute_definitions FOR ALL USING (auth_has_role('management'));

-- ---- machine_attribute_links ----
DROP POLICY IF EXISTS attr_links_manage ON machine_attribute_links;
CREATE POLICY attr_links_manage ON machine_attribute_links FOR ALL USING (auth_has_role('management'));

-- ---- user_machine_attribute_values ----
DROP POLICY IF EXISTS umav_select ON user_machine_attribute_values;
DROP POLICY IF EXISTS umav_write ON user_machine_attribute_values;
DROP POLICY IF EXISTS umav_update ON user_machine_attribute_values;
DROP POLICY IF EXISTS umav_delete ON user_machine_attribute_values;
CREATE POLICY umav_select ON user_machine_attribute_values FOR SELECT USING (
  user_id = auth.uid() OR auth_has_any_role(ARRAY['trainer','management'])
);
CREATE POLICY umav_write ON user_machine_attribute_values FOR INSERT WITH CHECK (
  auth_has_any_role(ARRAY['trainer','management'])
);
CREATE POLICY umav_update ON user_machine_attribute_values FOR UPDATE USING (
  auth_has_any_role(ARRAY['trainer','management'])
);
CREATE POLICY umav_delete ON user_machine_attribute_values FOR DELETE USING (
  auth_has_any_role(ARRAY['trainer','management'])
);
