-- Migration to add ohio_to_indiana_pickup_quote column to orders table
-- This stores the smaller quote amount for Ohio to Indiana pickup truckloads
-- when an order has both middlefield and ohio_to_indiana load types
-- The delivery truckload gets the full quote, and the pickup quote is deducted from delivery driver's pay

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS ohio_to_indiana_pickup_quote DECIMAL(10, 2);

-- Add index for efficient queries on ohio to indiana orders
CREATE INDEX IF NOT EXISTS idx_orders_ohio_to_indiana_pickup_quote 
ON orders(middlefield, oh_to_in, ohio_to_indiana_pickup_quote) 
WHERE middlefield = true AND oh_to_in = true;

