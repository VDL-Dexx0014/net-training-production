-- Remove user machine attribute values where the stored value is no longer
-- in the attribute definition's allowed_values list.
-- These became stale when allowed_values were redefined (e.g. S8 -> numeric, Forward/Back, etc.)
-- Trainers will re-enter correct values via the session UI.

DELETE FROM user_machine_attribute_values umav
USING machine_attribute_definitions mad
WHERE umav.attribute_definition_id = mad.id
  AND mad.allowed_values IS NOT NULL
  AND array_length(mad.allowed_values, 1) > 0
  AND NOT (umav.value = ANY(mad.allowed_values));
