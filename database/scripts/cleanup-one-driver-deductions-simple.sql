-- SIMPLER VERSION: Delete all manual deductions from one-driver loads
-- This is a safer, simpler approach that deletes ALL manual deductions
-- from truckloads where the truckload has a single driver assigned
-- Split load deductions are preserved

-- Step 1: Preview what will be deleted (RUN THIS FIRST)
SELECT 
    cdfd.id,
    cdfd.truckload_id,
    cdfd.driver_name,
    cdfd.deduction,
    cdfd.comment,
    t.driver_id,
    u.full_name as driver_name_from_truckload
FROM cross_driver_freight_deductions cdfd
JOIN truckloads t ON cdfd.truckload_id = t.id
LEFT JOIN users u ON t.driver_id = u.id
WHERE cdfd.is_manual = true
  AND (cdfd.comment IS NULL OR cdfd.comment NOT LIKE '%split load%')
  AND t.driver_id IS NOT NULL
  AND NOT EXISTS (
    -- Exclude truckloads that have orders assigned to different drivers
    SELECT 1
    FROM truckload_order_assignments toa1
    JOIN truckloads t1 ON toa1.truckload_id = t1.id
    WHERE toa1.truckload_id != t.id
      AND t1.driver_id != t.driver_id
      AND EXISTS (
        SELECT 1
        FROM truckload_order_assignments toa2
        WHERE toa2.order_id = toa1.order_id
          AND toa2.truckload_id = t.id
      )
  )
ORDER BY cdfd.truckload_id, cdfd.created_at DESC;

-- Step 2: Count how many will be deleted
SELECT COUNT(*) as deductions_to_delete
FROM cross_driver_freight_deductions cdfd
JOIN truckloads t ON cdfd.truckload_id = t.id
WHERE cdfd.is_manual = true
  AND (cdfd.comment IS NULL OR cdfd.comment NOT LIKE '%split load%')
  AND t.driver_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM truckload_order_assignments toa1
    JOIN truckloads t1 ON toa1.truckload_id = t1.id
    WHERE toa1.truckload_id != t.id
      AND t1.driver_id != t.driver_id
      AND EXISTS (
        SELECT 1
        FROM truckload_order_assignments toa2
        WHERE toa2.order_id = toa1.order_id
          AND toa2.truckload_id = t.id
      )
  );

-- Step 3: DELETE (ONLY RUN AFTER REVIEWING STEPS 1 & 2)
-- Uncomment the DELETE statement below after you've verified the SELECT queries above
/*
DELETE FROM cross_driver_freight_deductions
WHERE id IN (
    SELECT cdfd.id
    FROM cross_driver_freight_deductions cdfd
    JOIN truckloads t ON cdfd.truckload_id = t.id
    WHERE cdfd.is_manual = true
      AND (cdfd.comment IS NULL OR cdfd.comment NOT LIKE '%split load%')
      AND t.driver_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM truckload_order_assignments toa1
        JOIN truckloads t1 ON toa1.truckload_id = t1.id
        WHERE toa1.truckload_id != t.id
          AND t1.driver_id != t.driver_id
          AND EXISTS (
            SELECT 1
            FROM truckload_order_assignments toa2
            WHERE toa2.order_id = toa1.order_id
              AND toa2.truckload_id = t.id
          )
      )
);
*/

