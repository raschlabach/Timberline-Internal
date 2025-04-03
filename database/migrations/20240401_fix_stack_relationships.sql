-- Fix stack relationships in trailer_layout_items
BEGIN;

-- First, drop the existing foreign key constraint if it exists
ALTER TABLE trailer_layout_items
DROP CONSTRAINT IF EXISTS fk_trailer_layout_items_stack;

-- Drop existing stack-related indexes
DROP INDEX IF EXISTS idx_layout_items_stack;
DROP INDEX IF EXISTS idx_trailer_layout_items_stack_id;

-- Modify stack_id to be a simple integer (not a foreign key)
ALTER TABLE trailer_layout_items
ALTER COLUMN stack_id TYPE INTEGER,
ALTER COLUMN stack_id DROP CONSTRAINT IF EXISTS fk_trailer_layout_items_stack;

-- Add stack position constraint
ALTER TABLE trailer_layout_items
DROP CONSTRAINT IF EXISTS check_stack_position;

ALTER TABLE trailer_layout_items
ADD CONSTRAINT check_stack_position 
CHECK (stack_position IS NULL OR stack_position > 0);

-- Add composite index for efficient stack queries
CREATE INDEX idx_layout_items_stack_position 
ON trailer_layout_items(stack_id, stack_position) 
WHERE stack_id IS NOT NULL;

-- Add constraint to ensure stack_id and stack_position are used together
ALTER TABLE trailer_layout_items
DROP CONSTRAINT IF EXISTS check_stack_id_vinyl;

ALTER TABLE trailer_layout_items
ADD CONSTRAINT check_stack_consistency
CHECK (
    (stack_id IS NOT NULL AND stack_position IS NOT NULL) OR
    (stack_id IS NULL AND stack_position IS NULL)
);

COMMIT; 