-- Fix trailer_layout_items id sequence after consolidation migration
-- The 20240403 migration copied rows with explicit IDs into a new SERIAL table
-- but the sequence was never reset, causing "duplicate key" errors on INSERT.

SELECT setval(
  pg_get_serial_sequence('trailer_layout_items', 'id'),
  COALESCE((SELECT MAX(id) FROM trailer_layout_items), 0) + 1,
  false
);
