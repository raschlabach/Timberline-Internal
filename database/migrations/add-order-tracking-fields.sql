-- Migration to add user tracking fields to orders table and create a consolidated freight_items table

-- Add user tracking fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_edited_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS has_comments BOOLEAN DEFAULT FALSE;

-- Create consolidated freight_items table
CREATE TABLE IF NOT EXISTS freight_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('skid', 'vinyl', 'footage')),
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    length DECIMAL(10, 2),
    width DECIMAL(10, 2),
    height DECIMAL(10, 2),
    weight DECIMAL(10, 2),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    last_edited_at TIMESTAMP,
    last_edited_by INTEGER REFERENCES users(id)
);

-- Create index on order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_freight_items_order_id ON freight_items(order_id);

-- Function to calculate has_comments value
CREATE OR REPLACE FUNCTION update_has_comments()
RETURNS TRIGGER AS $$
BEGIN
    NEW.has_comments = (NEW.comments IS NOT NULL AND LENGTH(NEW.comments) > 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update has_comments
CREATE TRIGGER update_order_has_comments
BEFORE INSERT OR UPDATE OF comments ON orders
FOR EACH ROW EXECUTE FUNCTION update_has_comments();

-- Update existing records to set has_comments correctly
UPDATE orders SET has_comments = (comments IS NOT NULL AND LENGTH(comments) > 0); 