-- Fix stack columns in trailer_layout_items
BEGIN;

-- First, ensure the columns exist
ALTER TABLE trailer_layout_items
ADD COLUMN IF NOT EXISTS stack_id INTEGER,
ADD COLUMN IF NOT EXISTS stack_position INTEGER;

-- Add index for stack-related queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_layout_items_stack 
ON trailer_layout_items(stack_id, stack_position);

-- Add constraint to ensure stack_position is positive when present
ALTER TABLE trailer_layout_items
DROP CONSTRAINT IF EXISTS check_stack_position;

ALTER TABLE trailer_layout_items
ADD CONSTRAINT check_stack_position 
CHECK (stack_position IS NULL OR stack_position > 0);

-- Add constraint to ensure stack_id is only used with vinyl items
ALTER TABLE trailer_layout_items
DROP CONSTRAINT IF EXISTS check_stack_id_vinyl;

ALTER TABLE trailer_layout_items
ADD CONSTRAINT check_stack_id_vinyl
CHECK (
    (item_type = 'vinyl') OR
    (item_type != 'vinyl' AND stack_id IS NULL)
);

COMMIT; 