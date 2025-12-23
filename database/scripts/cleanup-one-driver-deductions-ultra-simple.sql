-- ULTRA SIMPLE VERSION: Delete ALL manual deductions (except split loads)
-- Use this if you want to start completely fresh
-- WARNING: This will delete ALL manual deductions, not just from one-driver loads

-- Step 1: See how many will be deleted
SELECT COUNT(*) as total_manual_deductions_to_delete
FROM cross_driver_freight_deductions
WHERE is_manual = true
  AND (comment IS NULL OR comment NOT LIKE '%split load%');

-- Step 2: Preview what will be deleted
SELECT 
    id,
    truckload_id,
    driver_name,
    deduction,
    comment,
    created_at
FROM cross_driver_freight_deductions
WHERE is_manual = true
  AND (comment IS NULL OR comment NOT LIKE '%split load%')
ORDER BY truckload_id, created_at DESC
LIMIT 100;  -- Preview first 100

-- Step 3: DELETE ALL manual deductions (except split loads)
-- UNCOMMENT BELOW AFTER REVIEWING STEPS 1 & 2
/*
DELETE FROM cross_driver_freight_deductions
WHERE is_manual = true
  AND (comment IS NULL OR comment NOT LIKE '%split load%');
*/

