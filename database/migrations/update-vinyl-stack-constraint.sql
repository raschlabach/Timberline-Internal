-- Drop the existing constraint
ALTER TABLE trailer_layout_items
DROP CONSTRAINT IF EXISTS check_stack_id_vinyl;

-- Add updated constraint to ensure stack_id is only used with vinyl items
ALTER TABLE trailer_layout_items
ADD CONSTRAINT check_stack_id_vinyl
CHECK (
    (item_type = 'vinyl') OR
    (item_type != 'vinyl' AND stack_id IS NULL)
); 