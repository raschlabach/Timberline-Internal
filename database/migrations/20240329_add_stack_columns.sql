-- Add stack-related columns to trailer_layout_items
BEGIN;

ALTER TABLE trailer_layout_items
ADD COLUMN IF NOT EXISTS stack_id INTEGER,
ADD COLUMN IF NOT EXISTS stack_position INTEGER;

-- Add index for stack-related queries
CREATE INDEX IF NOT EXISTS idx_layout_items_stack ON trailer_layout_items(stack_id, stack_position);

-- Add constraint to ensure stack_position is positive when present
ALTER TABLE trailer_layout_items
ADD CONSTRAINT check_stack_position 
CHECK (stack_position IS NULL OR stack_position > 0);

COMMIT; 