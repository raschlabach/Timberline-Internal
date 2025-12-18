-- Migration to add middlefield_delivery_quote column to orders table
-- This stores the smaller quote amount for Middlefield delivery truckloads
-- when an order has both backhaul and middlefield load types

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS middlefield_delivery_quote DECIMAL(10, 2);

-- Add index for efficient queries on middlefield orders
CREATE INDEX IF NOT EXISTS idx_orders_middlefield_delivery_quote 
ON orders(middlefield, backhaul, middlefield_delivery_quote) 
WHERE middlefield = true AND backhaul = true;

