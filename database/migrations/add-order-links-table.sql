-- Migration to add order_links table
BEGIN;

-- Create order_links table
CREATE TABLE IF NOT EXISTS order_links (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_links_order ON order_links(order_id);

-- Add update_timestamp trigger
CREATE TRIGGER update_timestamp BEFORE UPDATE ON order_links FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Update the load_board_view if necessary (no changes needed for now)

COMMIT; 