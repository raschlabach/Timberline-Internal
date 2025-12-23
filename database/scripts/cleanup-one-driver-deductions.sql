-- Cleanup script to delete manual deductions from one-driver truckloads
-- This removes duplicate auto-created deductions that shouldn't exist
-- Split load deductions are preserved

-- First, let's see what we're about to delete (for verification)
SELECT 
    COUNT(*) as total_deductions_to_delete,
    COUNT(DISTINCT truckload_id) as affected_truckloads
FROM cross_driver_freight_deductions cdfd
WHERE cdfd.is_manual = true
  AND (cdfd.comment IS NULL OR cdfd.comment NOT LIKE '%split load%')
  AND cdfd.truckload_id IN (
    -- Find truckloads where all orders have the same driver
    SELECT DISTINCT t.id
    FROM truckloads t
    WHERE NOT EXISTS (
      -- Check if there are orders with different drivers
      SELECT 1
      FROM truckload_order_assignments toa1
      JOIN truckload_order_assignments toa2 
        ON toa1.order_id = toa2.order_id 
        AND toa1.assignment_type != toa2.assignment_type
      JOIN truckloads t1 ON toa1.truckload_id = t1.id
      JOIN truckloads t2 ON toa2.truckload_id = t2.id
      WHERE (t1.id = t.id OR t2.id = t.id)
        AND t1.driver_id != t2.driver_id
    )
    AND EXISTS (
      -- Make sure truckload has at least one order
      SELECT 1
      FROM truckload_order_assignments toa
      WHERE toa.truckload_id = t.id
    )
  );

-- Now delete the deductions
-- WARNING: This will permanently delete the data. Make sure you've reviewed the SELECT above first.
DELETE FROM cross_driver_freight_deductions
WHERE is_manual = true
  AND (comment IS NULL OR comment NOT LIKE '%split load%')
  AND truckload_id IN (
    -- Find truckloads where all orders have the same driver
    SELECT DISTINCT t.id
    FROM truckloads t
    WHERE NOT EXISTS (
      -- Check if there are orders with different drivers
      SELECT 1
      FROM truckload_order_assignments toa1
      JOIN truckload_order_assignments toa2 
        ON toa1.order_id = toa2.order_id 
        AND toa1.assignment_type != toa2.assignment_type
      JOIN truckloads t1 ON toa1.truckload_id = t1.id
      JOIN truckloads t2 ON toa2.truckload_id = t2.id
      WHERE (t1.id = t.id OR t2.id = t.id)
        AND t1.driver_id != t2.driver_id
    )
    AND EXISTS (
      -- Make sure truckload has at least one order
      SELECT 1
      FROM truckload_order_assignments toa
      WHERE toa.truckload_id = t.id
    )
  );

-- Verify deletion (should return 0 or very few rows)
SELECT 
    COUNT(*) as remaining_manual_deductions_in_one_driver_loads
FROM cross_driver_freight_deductions cdfd
WHERE cdfd.is_manual = true
  AND (cdfd.comment IS NULL OR cdfd.comment NOT LIKE '%split load%')
  AND cdfd.truckload_id IN (
    SELECT DISTINCT t.id
    FROM truckloads t
    WHERE NOT EXISTS (
      SELECT 1
      FROM truckload_order_assignments toa1
      JOIN truckload_order_assignments toa2 
        ON toa1.order_id = toa2.order_id 
        AND toa1.assignment_type != toa2.assignment_type
      JOIN truckloads t1 ON toa1.truckload_id = t1.id
      JOIN truckloads t2 ON toa2.truckload_id = t2.id
      WHERE (t1.id = t.id OR t2.id = t.id)
        AND t1.driver_id != t2.driver_id
    )
    AND EXISTS (
      SELECT 1
      FROM truckload_order_assignments toa
      WHERE toa.truckload_id = t.id
    )
  );

