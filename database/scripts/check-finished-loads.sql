-- Check which loads should be marked as finished
-- This helps identify loads that are complete but not marked as such

-- 1. Check loads with all_packs_finished NULL or FALSE
SELECT 
    l.load_id,
    l.actual_arrival_date,
    l.all_packs_finished,
    COUNT(p.id) as pack_count,
    COUNT(CASE WHEN p.is_finished = TRUE THEN 1 END) as finished_pack_count,
    SUM(li.actual_footage) as total_actual_footage,
    SUM(p.tally_board_feet) FILTER (WHERE p.is_finished = TRUE) as finished_footage
FROM lumber_loads l
JOIN lumber_load_items li ON li.load_id = l.id
LEFT JOIN lumber_packs p ON p.load_item_id = li.id
WHERE l.actual_arrival_date IS NOT NULL
GROUP BY l.id, l.load_id, l.actual_arrival_date, l.all_packs_finished
ORDER BY l.actual_arrival_date DESC;

-- 2. Find loads that should be marked as finished
-- (where all packs are finished but load is not marked as such)
SELECT 
    l.load_id,
    l.all_packs_finished,
    COUNT(p.id) as total_packs,
    COUNT(CASE WHEN p.is_finished = TRUE THEN 1 END) as finished_packs
FROM lumber_loads l
JOIN lumber_load_items li ON li.load_id = l.id
LEFT JOIN lumber_packs p ON p.load_item_id = li.id
WHERE l.actual_arrival_date IS NOT NULL
  AND COALESCE(l.all_packs_finished, FALSE) = FALSE
GROUP BY l.id, l.load_id, l.all_packs_finished
HAVING COUNT(p.id) > 0 
   AND COUNT(p.id) = COUNT(CASE WHEN p.is_finished = TRUE THEN 1 END);

-- 3. Update loads that should be marked as finished (UNCOMMENT TO RUN)
/*
UPDATE lumber_loads l
SET all_packs_finished = TRUE
WHERE l.id IN (
    SELECT l.id
    FROM lumber_loads l
    JOIN lumber_load_items li ON li.load_id = l.id
    LEFT JOIN lumber_packs p ON p.load_item_id = li.id
    WHERE l.actual_arrival_date IS NOT NULL
      AND COALESCE(l.all_packs_finished, FALSE) = FALSE
    GROUP BY l.id
    HAVING COUNT(p.id) > 0 
       AND COUNT(p.id) = COUNT(CASE WHEN p.is_finished = TRUE THEN 1 END)
);
*/

-- 4. For loads with NO packs at all (not started ripping yet)
-- These should stay in inventory until packs are created
SELECT 
    l.load_id,
    l.actual_arrival_date,
    l.all_packs_finished,
    COUNT(p.id) as pack_count
FROM lumber_loads l
JOIN lumber_load_items li ON li.load_id = l.id
LEFT JOIN lumber_packs p ON p.load_item_id = li.id
WHERE l.actual_arrival_date IS NOT NULL
GROUP BY l.id, l.load_id, l.actual_arrival_date, l.all_packs_finished
HAVING COUNT(p.id) = 0
ORDER BY l.actual_arrival_date DESC;
