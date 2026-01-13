-- Change price columns to support 3 decimal places (thousands place)
-- From DECIMAL(10,2) / DECIMAL(12,2) to DECIMAL(10,3) / DECIMAL(12,3)

-- Update lumber_load_items table
ALTER TABLE lumber_load_items 
ALTER COLUMN price TYPE DECIMAL(10, 3);

-- Update lumber_load_preset_items table
ALTER TABLE lumber_load_preset_items 
ALTER COLUMN price TYPE DECIMAL(12, 3);

-- Note: This migration is safe - it only increases precision, doesn't lose data
