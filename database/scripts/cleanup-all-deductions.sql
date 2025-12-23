-- Delete ALL manual deductions including split loads
-- This will completely clean the slate for manual deductions

-- Step 1: Count what will be deleted
SELECT 
    COUNT(*) as total_manual_deductions,
    COUNT(CASE WHEN comment LIKE '%split load%' THEN 1 END) as split_load_deductions,
    COUNT(CASE WHEN comment IS NULL OR comment NOT LIKE '%split load%' THEN 1 END) as other_manual_deductions
FROM cross_driver_freight_deductions
WHERE is_manual = true;

-- Step 2: Preview what will be deleted (first 50)
SELECT 
    id,
    truckload_id,
    driver_name,
    deduction,
    comment,
    is_addition,
    applies_to,
    created_at
FROM cross_driver_freight_deductions
WHERE is_manual = true
ORDER BY truckload_id, created_at DESC
LIMIT 50;

-- Step 3: DELETE ALL manual deductions (including split loads)
DELETE FROM cross_driver_freight_deductions
WHERE is_manual = true;

-- Step 4: Verify deletion (should return 0)
SELECT COUNT(*) as remaining_manual_deductions
FROM cross_driver_freight_deductions
WHERE is_manual = true;

