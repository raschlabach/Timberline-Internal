-- Safe migration to change price precision from 2 to 3 decimal places
-- This handles the view that depends on the price column

-- Step 1: Drop the view that depends on lumber_load_preset_items
DROP VIEW IF EXISTS lumber_load_presets_with_items CASCADE;

-- Step 2: Alter the columns to support 3 decimal places
ALTER TABLE lumber_load_items 
ALTER COLUMN price TYPE DECIMAL(10, 3);

ALTER TABLE lumber_load_preset_items 
ALTER COLUMN price TYPE DECIMAL(12, 3);

-- Step 3: Recreate the view with the new column type
CREATE OR REPLACE VIEW lumber_load_presets_with_items AS
SELECT 
  p.*,
  s.name as supplier_name,
  sl.location_name as supplier_location_name,
  u.full_name as created_by_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', pi.id,
        'species', pi.species,
        'grade', pi.grade,
        'thickness', pi.thickness,
        'estimated_footage', pi.estimated_footage,
        'price', pi.price,
        'display_order', pi.display_order
      ) ORDER BY pi.display_order, pi.id
    ) FILTER (WHERE pi.id IS NOT NULL),
    '[]'::json
  ) as items
FROM lumber_load_presets p
LEFT JOIN lumber_suppliers s ON p.supplier_id = s.id
LEFT JOIN lumber_supplier_locations sl ON p.supplier_location_id = sl.id
LEFT JOIN users u ON p.created_by = u.id
LEFT JOIN lumber_load_preset_items pi ON p.id = pi.preset_id
GROUP BY p.id, s.name, sl.location_name, u.full_name
ORDER BY p.is_favorite DESC, s.name, p.preset_name;
