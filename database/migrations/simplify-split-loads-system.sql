-- Migration to simplify split loads system
-- This creates a single split_loads table as the source of truth
-- and adds a foreign key to cross_driver_freight_deductions for easy cleanup

-- Step 1: Create split_loads table (replaces pending_split_loads)
CREATE TABLE IF NOT EXISTS split_loads (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  misc_value DECIMAL(10, 2) NOT NULL,
  full_quote_assignment VARCHAR(20) NOT NULL, -- 'pickup' or 'delivery'
  full_quote_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay', -- 'load_value' or 'driver_pay'
  misc_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay', -- 'load_value' or 'driver_pay'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id)
);

-- Step 2: Migrate data from pending_split_loads if it exists
INSERT INTO split_loads (order_id, misc_value, full_quote_assignment, full_quote_applies_to, misc_applies_to, created_at, updated_at)
SELECT order_id, misc_value, full_quote_assignment, full_quote_applies_to, misc_applies_to, created_at, updated_at
FROM pending_split_loads
WHERE NOT EXISTS (SELECT 1 FROM split_loads WHERE split_loads.order_id = pending_split_loads.order_id);

-- Step 3: Create split_loads from existing split load deductions (for old system)
-- Find unique order_ids that have split load deductions but no split_loads record
INSERT INTO split_loads (order_id, misc_value, full_quote_assignment, full_quote_applies_to, misc_applies_to, created_at, updated_at)
SELECT DISTINCT
  cdfd.order_id,
  COALESCE(ABS(cdfd.deduction), 0) as misc_value,
  'delivery' as full_quote_assignment, -- Default, will be corrected when user edits
  COALESCE(cdfd.applies_to, 'driver_pay') as full_quote_applies_to,
  COALESCE(cdfd.applies_to, 'driver_pay') as misc_applies_to,
  MIN(cdfd.created_at) as created_at,
  MAX(cdfd.updated_at) as updated_at
FROM cross_driver_freight_deductions cdfd
WHERE cdfd.comment LIKE '%split load%'
  AND cdfd.is_manual = true
  AND cdfd.order_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM split_loads WHERE split_loads.order_id = cdfd.order_id)
GROUP BY cdfd.order_id, cdfd.applies_to
ON CONFLICT (order_id) DO NOTHING;

-- Step 4: Add split_load_id column to cross_driver_freight_deductions for easy cleanup
ALTER TABLE cross_driver_freight_deductions
ADD COLUMN IF NOT EXISTS split_load_id INTEGER REFERENCES split_loads(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_split_loads_order ON split_loads(order_id);
CREATE INDEX IF NOT EXISTS idx_deductions_split_load ON cross_driver_freight_deductions(split_load_id);

-- Step 5: Link existing split load deductions to split_loads records
UPDATE cross_driver_freight_deductions cdfd
SET split_load_id = sl.id
FROM split_loads sl
WHERE cdfd.comment LIKE '%split load%'
  AND cdfd.is_manual = true
  AND cdfd.order_id = sl.order_id
  AND cdfd.split_load_id IS NULL;

-- Step 6: Clean up orphaned split load deductions (those without order_id or split_load_id)
-- These are the problematic ones that were causing issues
DELETE FROM cross_driver_freight_deductions
WHERE comment LIKE '%split load%'
  AND is_manual = true
  AND order_id IS NULL
  AND split_load_id IS NULL;

