-- Migration to clear old split_quote values from orders table
-- These values are no longer used - we now use assignment_quote on truckload_order_assignments

-- Clear split_quote values that don't have corresponding assignment_quote values
-- This ensures old data doesn't interfere with the new system
UPDATE orders o
SET split_quote = NULL
WHERE o.split_quote IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM truckload_order_assignments toa
    WHERE toa.order_id = o.id
      AND toa.assignment_quote IS NOT NULL
      AND toa.assignment_quote > 0
  );

-- Optional: If you want to completely remove the split_quote column after confirming everything works:
-- ALTER TABLE orders DROP COLUMN IF EXISTS split_quote;

