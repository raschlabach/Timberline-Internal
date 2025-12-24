-- Migration to add exclude_from_load_value column to truckload_order_assignments
-- This allows excluding specific order quotes from load value calculations

-- Add the exclude_from_load_value column
ALTER TABLE truckload_order_assignments 
ADD COLUMN IF NOT EXISTS exclude_from_load_value BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_assignments_exclude_from_load_value 
ON truckload_order_assignments(exclude_from_load_value) 
WHERE exclude_from_load_value = TRUE;

