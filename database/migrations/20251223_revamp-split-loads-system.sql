-- Migration to revamp split loads system
-- This migration cleans up all legacy split load artifacts and ensures
-- the new split_loads table is the single source of truth

-- ============================================================================
-- STEP 1: Data Preservation (Safe Migration)
-- ============================================================================

-- Migrate any valid data from pending_split_loads to split_loads (if not already migrated)
INSERT INTO split_loads (order_id, misc_value, full_quote_assignment, full_quote_applies_to, misc_applies_to, created_at, updated_at)
SELECT 
  psl.order_id,
  psl.misc_value,
  psl.full_quote_assignment,
  psl.full_quote_applies_to,
  psl.misc_applies_to,
  psl.created_at,
  psl.updated_at
FROM pending_split_loads psl
WHERE NOT EXISTS (
  SELECT 1 FROM split_loads sl WHERE sl.order_id = psl.order_id
)
ON CONFLICT (order_id) DO NOTHING;

-- Link existing split load deductions to split_loads records via split_load_id
UPDATE cross_driver_freight_deductions cdfd
SET split_load_id = sl.id
FROM split_loads sl
WHERE cdfd.comment LIKE '%split load%'
  AND cdfd.is_manual = true
  AND cdfd.order_id = sl.order_id
  AND cdfd.split_load_id IS NULL;

-- Validate all existing split_loads records have valid order_id references
-- (This will fail if there are invalid references, which is good - we want to know)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM split_loads sl
    LEFT JOIN orders o ON sl.order_id = o.id
    WHERE o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Found split_loads records with invalid order_id references';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Cleanup Orphaned Data
-- ============================================================================

-- Remove split load deductions without valid split_load_id or order_id
DELETE FROM cross_driver_freight_deductions
WHERE comment LIKE '%split load%'
  AND is_manual = true
  AND order_id IS NULL
  AND split_load_id IS NULL;

-- Remove deductions that reference non-existent orders
DELETE FROM cross_driver_freight_deductions
WHERE comment LIKE '%split load%'
  AND is_manual = true
  AND order_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.id = cross_driver_freight_deductions.order_id
  );

-- Clear any assignment_quote values that don't have corresponding split_loads records
-- (Safety check - these shouldn't exist, but clean them up if they do)
UPDATE truckload_order_assignments toa
SET assignment_quote = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE toa.assignment_quote IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM split_loads sl
    JOIN truckload_order_assignments toa2 ON sl.order_id = toa2.order_id
    WHERE toa2.id = toa.id
  )
  AND EXISTS (
    -- Only clear if there's another assignment for the same order (indicating it was a split)
    SELECT 1
    FROM truckload_order_assignments toa3
    WHERE toa3.order_id = toa.order_id
      AND toa3.id != toa.id
  );

-- ============================================================================
-- STEP 3: Remove Legacy Tables/Columns
-- ============================================================================

-- Drop pending_split_loads table (CASCADE will handle any remaining references)
DROP TABLE IF EXISTS pending_split_loads CASCADE;

-- Drop old columns from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS split_quote;
ALTER TABLE orders DROP COLUMN IF EXISTS middlefield_delivery_quote;
ALTER TABLE orders DROP COLUMN IF EXISTS ohio_to_indiana_pickup_quote;

-- Drop old indexes related to removed columns
DROP INDEX IF EXISTS idx_orders_split_quote;
DROP INDEX IF EXISTS idx_orders_middlefield_delivery_quote;
DROP INDEX IF EXISTS idx_pending_split_loads_order;
DROP INDEX IF EXISTS idx_pending_split_loads_assignment;

-- ============================================================================
-- STEP 4: Ensure New System Integrity
-- ============================================================================

-- Ensure split_loads table structure is correct
CREATE TABLE IF NOT EXISTS split_loads (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  misc_value DECIMAL(10, 2) NOT NULL,
  full_quote_assignment VARCHAR(20) NOT NULL,
  full_quote_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay',
  misc_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id),
  CHECK (full_quote_assignment IN ('pickup', 'delivery')),
  CHECK (full_quote_applies_to IN ('load_value', 'driver_pay')),
  CHECK (misc_applies_to IN ('load_value', 'driver_pay')),
  CHECK (misc_value > 0)
);

-- Ensure split_load_id column exists on cross_driver_freight_deductions
ALTER TABLE cross_driver_freight_deductions
ADD COLUMN IF NOT EXISTS split_load_id INTEGER REFERENCES split_loads(id) ON DELETE CASCADE;

-- Create indexes if missing
CREATE INDEX IF NOT EXISTS idx_split_loads_order ON split_loads(order_id);
CREATE INDEX IF NOT EXISTS idx_deductions_split_load ON cross_driver_freight_deductions(split_load_id);

-- Add CHECK constraints if they don't exist (PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$
BEGIN
  -- Check if constraints exist before adding
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'split_loads_full_quote_assignment_check'
  ) THEN
    ALTER TABLE split_loads 
    ADD CONSTRAINT split_loads_full_quote_assignment_check 
    CHECK (full_quote_assignment IN ('pickup', 'delivery'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'split_loads_full_quote_applies_to_check'
  ) THEN
    ALTER TABLE split_loads 
    ADD CONSTRAINT split_loads_full_quote_applies_to_check 
    CHECK (full_quote_applies_to IN ('load_value', 'driver_pay'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'split_loads_misc_applies_to_check'
  ) THEN
    ALTER TABLE split_loads 
    ADD CONSTRAINT split_loads_misc_applies_to_check 
    CHECK (misc_applies_to IN ('load_value', 'driver_pay'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'split_loads_misc_value_check'
  ) THEN
    ALTER TABLE split_loads 
    ADD CONSTRAINT split_loads_misc_value_check 
    CHECK (misc_value > 0);
  END IF;
END $$;

