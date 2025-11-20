-- Migration to make order_id nullable in order_links table
-- This allows files to be uploaded before an order is created
BEGIN;

-- Drop the NOT NULL constraint on order_id
ALTER TABLE order_links 
ALTER COLUMN order_id DROP NOT NULL;

COMMIT;

