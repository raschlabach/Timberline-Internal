-- ============================================================================
-- CLEANUP SCRIPT: Mark Finished Loads Based on User's Current State
-- ============================================================================
-- This script marks loads as finished that are NOT in the active inventory
-- or incoming lists provided by the user.
--
-- ACTIVE INVENTORY LOAD IDs (52 loads):
-- R-25329, R-25326, R-25324, R-25323, R-25319, R-25315, R-25303, R-25302,
-- R-25300, R-25299, R-25294, R-25292, R-25277, R-25271, R-25266, R-25265,
-- R-25260, R-25257, R-25255, R-25254, R-25253, R-25247, R-25243, R-25240,
-- R-25236, R-25235, R-25230, R-25226, R-25222, R-25219, R-25162, R-25088,
-- R-25047, R-25038, R-25036, R-25025, R-25019, R-25015, R-24345, R-24326,
-- R-24303, R-24298, R-24243, R-24127, R-23768, R-23759, R-23750, R-22430,
-- R-22402, R-21377, R-21072, R-4276
--
-- INCOMING LOAD IDs (17 loads):
-- R-25180, R-25267, R-25268, R-25270, R-25301, R-25305, R-25317, R-25324,
-- R-25325, R-25327, R-25328, R-25331, R-25332, R-25333, R-25334, R-25335,
-- R-25336
--
-- ALL OTHER LOADS = FINISHED
-- ============================================================================

BEGIN;

-- Step 1: Check current state before cleanup
SELECT 
    'Before Cleanup' as status,
    COUNT(*) as total_loads,
    COUNT(CASE WHEN all_packs_finished = TRUE THEN 1 END) as finished_loads,
    COUNT(CASE WHEN all_packs_finished = FALSE OR all_packs_finished IS NULL THEN 1 END) as active_loads
FROM lumber_loads;

-- Step 2: Mark all loads as finished EXCEPT the ones in active inventory or incoming
UPDATE lumber_loads
SET all_packs_finished = TRUE
WHERE load_id NOT IN (
    -- Active inventory loads
    'R-25329', 'R-25326', 'R-25324', 'R-25323', 'R-25319', 'R-25315', 'R-25303', 'R-25302',
    'R-25300', 'R-25299', 'R-25294', 'R-25292', 'R-25277', 'R-25271', 'R-25266', 'R-25265',
    'R-25260', 'R-25257', 'R-25255', 'R-25254', 'R-25253', 'R-25247', 'R-25243', 'R-25240',
    'R-25236', 'R-25235', 'R-25230', 'R-25226', 'R-25222', 'R-25219', 'R-25162', 'R-25088',
    'R-25047', 'R-25038', 'R-25036', 'R-25025', 'R-25019', 'R-25015', 'R-24345', 'R-24326',
    'R-24303', 'R-24298', 'R-24243', 'R-24127', 'R-23768', 'R-23759', 'R-23750', 'R-22430',
    'R-22402', 'R-21377', 'R-21072', 'R-4276',
    -- Incoming loads (not yet arrived)
    'R-25180', 'R-25267', 'R-25268', 'R-25270', 'R-25301', 'R-25305', 'R-25317',
    'R-25325', 'R-25327', 'R-25328', 'R-25331', 'R-25332', 'R-25333', 'R-25334',
    'R-25335', 'R-25336'
)
AND COALESCE(all_packs_finished, FALSE) = FALSE;

-- Step 3: Ensure active inventory loads are marked as NOT finished
UPDATE lumber_loads
SET all_packs_finished = FALSE
WHERE load_id IN (
    'R-25329', 'R-25326', 'R-25324', 'R-25323', 'R-25319', 'R-25315', 'R-25303', 'R-25302',
    'R-25300', 'R-25299', 'R-25294', 'R-25292', 'R-25277', 'R-25271', 'R-25266', 'R-25265',
    'R-25260', 'R-25257', 'R-25255', 'R-25254', 'R-25253', 'R-25247', 'R-25243', 'R-25240',
    'R-25236', 'R-25235', 'R-25230', 'R-25226', 'R-25222', 'R-25219', 'R-25162', 'R-25088',
    'R-25047', 'R-25038', 'R-25036', 'R-25025', 'R-25019', 'R-25015', 'R-24345', 'R-24326',
    'R-24303', 'R-24298', 'R-24243', 'R-24127', 'R-23768', 'R-23759', 'R-23750', 'R-22430',
    'R-22402', 'R-21377', 'R-21072', 'R-4276'
);

-- Step 4: Ensure incoming loads are marked as NOT finished
UPDATE lumber_loads
SET all_packs_finished = FALSE
WHERE load_id IN (
    'R-25180', 'R-25267', 'R-25268', 'R-25270', 'R-25301', 'R-25305', 'R-25317',
    'R-25325', 'R-25327', 'R-25328', 'R-25331', 'R-25332', 'R-25333', 'R-25334',
    'R-25335', 'R-25336'
);

-- Step 5: Check state after cleanup
SELECT 
    'After Cleanup' as status,
    COUNT(*) as total_loads,
    COUNT(CASE WHEN all_packs_finished = TRUE THEN 1 END) as finished_loads,
    COUNT(CASE WHEN all_packs_finished = FALSE THEN 1 END) as active_loads
FROM lumber_loads;

-- Step 6: Show loads that were marked as finished (for verification)
SELECT 
    load_id,
    actual_arrival_date,
    'Marked as FINISHED' as action
FROM lumber_loads
WHERE all_packs_finished = TRUE
ORDER BY load_id DESC
LIMIT 20;

-- Step 7: Show active inventory loads (for verification)
SELECT 
    load_id,
    actual_arrival_date,
    all_packs_finished,
    'Active in INVENTORY' as status
FROM lumber_loads
WHERE load_id IN (
    'R-25329', 'R-25326', 'R-25324', 'R-25323', 'R-25319', 'R-25315', 'R-25303', 'R-25302',
    'R-25300', 'R-25299', 'R-25294', 'R-25292', 'R-25277', 'R-25271', 'R-25266', 'R-25265',
    'R-25260', 'R-25257', 'R-25255', 'R-25254', 'R-25253', 'R-25247', 'R-25243', 'R-25240',
    'R-25236', 'R-25235', 'R-25230', 'R-25226', 'R-25222', 'R-25219', 'R-25162', 'R-25088',
    'R-25047', 'R-25038', 'R-25036', 'R-25025', 'R-25019', 'R-25015', 'R-24345', 'R-24326',
    'R-24303', 'R-24298', 'R-24243', 'R-24127', 'R-23768', 'R-23759', 'R-23750', 'R-22430',
    'R-22402', 'R-21377', 'R-21072', 'R-4276'
)
ORDER BY load_id DESC;

-- COMMIT or ROLLBACK
-- Uncomment one of the following:
-- COMMIT;   -- Apply the changes
ROLLBACK; -- Undo the changes (default - safe for testing)
