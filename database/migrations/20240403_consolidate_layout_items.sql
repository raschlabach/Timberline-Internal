-- Consolidate trailer_layout_items table structure
BEGIN;

-- Create a new table with the consolidated structure
CREATE TABLE trailer_layout_items_new (
    id SERIAL PRIMARY KEY,
    trailer_layout_id INTEGER NOT NULL REFERENCES trailer_layouts(id),
    item_type VARCHAR(20) NOT NULL,
    item_id INTEGER NOT NULL,
    x_position INTEGER NOT NULL,
    y_position INTEGER NOT NULL,
    width INTEGER NOT NULL,
    length INTEGER NOT NULL,
    rotation INTEGER DEFAULT 0,
    stack_id INTEGER,
    stack_position INTEGER,
    customer_id INTEGER,
    customer_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_rotation CHECK (rotation IN (0, 90, 180, 270)),
    CONSTRAINT check_stack_position CHECK (
        (stack_id IS NULL AND stack_position IS NULL) OR
        (stack_id IS NOT NULL AND stack_position > 0)
    ),
    CONSTRAINT check_customer_info CHECK (
        (customer_id IS NULL AND customer_name IS NULL) OR
        (customer_id IS NOT NULL AND customer_name IS NOT NULL)
    )
);

-- Copy data from the old table to the new one (conditionally handle stack_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trailer_layout_items'
      AND column_name = 'stack_id'
  ) THEN
    INSERT INTO trailer_layout_items_new (
        id, trailer_layout_id, item_type, item_id, x_position, y_position,
        width, length, rotation, stack_id, stack_position, customer_id,
        customer_name, created_at, updated_at
    )
    SELECT 
        id, trailer_layout_id, item_type, item_id, x_position, y_position,
        width, length, rotation, stack_id, stack_position, customer_id,
        customer_name, created_at, updated_at
    FROM trailer_layout_items;
  ELSE
    RAISE NOTICE 'Skipping step in 20240403_consolidate_layout_items.sql: stack_id not present in source table';
    INSERT INTO trailer_layout_items_new (
        id, trailer_layout_id, item_type, item_id, x_position, y_position,
        width, length, rotation, stack_position, customer_id,
        customer_name, created_at, updated_at
    )
    SELECT 
        id, trailer_layout_id, item_type, item_id, x_position, y_position,
        width, length, rotation, stack_position, customer_id,
        customer_name, created_at, updated_at
    FROM trailer_layout_items;
  END IF;
END $$;

-- Drop the old table and rename the new one
DROP TABLE IF EXISTS trailer_layout_items;
ALTER TABLE trailer_layout_items_new RENAME TO trailer_layout_items;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_layout_items_layout ON trailer_layout_items(trailer_layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_items_position ON trailer_layout_items(x_position, y_position);
CREATE INDEX IF NOT EXISTS idx_layout_items_customer ON trailer_layout_items(customer_id);

-- Conditionally create stack index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trailer_layout_items'
      AND column_name = 'stack_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_layout_items_stack ON trailer_layout_items(stack_id, stack_position);
  ELSE
    RAISE NOTICE 'Skipping step in 20240403_consolidate_layout_items.sql: stack_id not present';
  END IF;
END $$;

-- Add update timestamp trigger
CREATE TRIGGER update_timestamp BEFORE UPDATE ON trailer_layout_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

COMMIT;
