-- Add stack_id and stack_position columns to trailer_layout_items table
ALTER TABLE trailer_layout_items
ADD COLUMN IF NOT EXISTS stack_id INTEGER,
ADD COLUMN IF NOT EXISTS stack_position INTEGER;

-- Add index on stack_id for better query performance
CREATE INDEX IF NOT EXISTS idx_trailer_layout_items_stack_id ON trailer_layout_items(stack_id);

-- Add foreign key constraint to ensure stack_id references a valid layout item
ALTER TABLE trailer_layout_items
ADD CONSTRAINT fk_trailer_layout_items_stack
FOREIGN KEY (stack_id) REFERENCES trailer_layout_items(id)
ON DELETE SET NULL; 