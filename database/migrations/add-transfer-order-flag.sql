-- Add is_transfer_order column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS is_transfer_order BOOLEAN DEFAULT FALSE;

-- Update existing orders to have is_transfer_order = true if they have both pickup and delivery assignments
UPDATE orders o
SET is_transfer_order = true
WHERE EXISTS (
  SELECT 1
  FROM truckload_order_assignments toa1
  JOIN truckload_order_assignments toa2 ON toa1.order_id = toa2.order_id
  WHERE toa1.order_id = o.id
  AND toa1.assignment_type = 'pickup'
  AND toa2.assignment_type = 'delivery'
); 