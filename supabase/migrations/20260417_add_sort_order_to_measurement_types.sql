-- Add sort_order column to measurement_types for admin-controlled ordering
ALTER TABLE measurement_types ADD COLUMN IF NOT EXISTS sort_order integer;

-- Default order based on current name ordering
UPDATE measurement_types SET sort_order = sub.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 AS row_num
  FROM measurement_types
) sub
WHERE measurement_types.id = sub.id;
