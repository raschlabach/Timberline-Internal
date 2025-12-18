-- Migration to simplify split loads to a single split_quote column
-- This consolidates middlefield_delivery_quote and ohio_to_indiana_pickup_quote into one field

-- First, migrate any existing ohio_to_indiana_pickup_quote values to split_quote
-- (if middlefield_delivery_quote doesn't exist, use ohio_to_indiana_pickup_quote)
UPDATE orders
SET middlefield_delivery_quote = COALESCE(middlefield_delivery_quote, ohio_to_indiana_pickup_quote)
WHERE ohio_to_indiana_pickup_quote IS NOT NULL 
  AND middlefield_delivery_quote IS NULL;

-- Rename middlefield_delivery_quote to split_quote for clarity
ALTER TABLE orders
RENAME COLUMN middlefield_delivery_quote TO split_quote;

-- Drop the ohio_to_indiana_pickup_quote column
ALTER TABLE orders
DROP COLUMN IF EXISTS ohio_to_indiana_pickup_quote;

-- Update the index
DROP INDEX IF EXISTS idx_orders_middlefield_delivery_quote;
CREATE INDEX IF NOT EXISTS idx_orders_split_quote 
ON orders(middlefield, backhaul, oh_to_in, split_quote) 
WHERE split_quote IS NOT NULL;

