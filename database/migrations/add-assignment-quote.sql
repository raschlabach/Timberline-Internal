-- Migration to add assignment_quote to truckload_order_assignments
-- This allows each assignment to have its own quote, simplifying split loads

-- Add the assignment_quote column
ALTER TABLE truckload_order_assignments 
ADD COLUMN IF NOT EXISTS assignment_quote DECIMAL(10, 2);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_assignments_quote 
ON truckload_order_assignments(assignment_quote) 
WHERE assignment_quote IS NOT NULL;

-- Migrate existing split_quote values from orders to assignments
-- For delivery assignments, set assignment_quote from split_quote
UPDATE truckload_order_assignments toa
SET assignment_quote = o.split_quote
FROM orders o
WHERE toa.order_id = o.id
  AND toa.assignment_type = 'delivery'
  AND o.split_quote IS NOT NULL
  AND o.split_quote > 0;

-- For pickup assignments, set assignment_quote from split_quote
UPDATE truckload_order_assignments toa
SET assignment_quote = o.split_quote
FROM orders o
WHERE toa.order_id = o.id
  AND toa.assignment_type = 'pickup'
  AND o.split_quote IS NOT NULL
  AND o.split_quote > 0;

