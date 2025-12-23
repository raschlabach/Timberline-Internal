-- Migration to simplify split loads system
-- This creates a single split_loads table as the source of truth
-- and adds a foreign key to cross_driver_freight_deductions for easy cleanup

-- Step 1: Rename pending_split_loads to split_loads and make it work for all split loads
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

-- Migrate data from pending_split_loads if it exists
INSERT INTO split_loads (order_id, misc_value, full_quote_assignment, full_quote_applies_to, misc_applies_to, created_at, updated_at)
SELECT order_id, misc_value, full_quote_assignment, full_quote_applies_to, misc_applies_to, created_at, updated_at
FROM pending_split_loads
ON CONFLICT (order_id) DO NOTHING;

-- Step 2: Add split_load_id column to cross_driver_freight_deductions for easy cleanup
ALTER TABLE cross_driver_freight_deductions
ADD COLUMN IF NOT EXISTS split_load_id INTEGER REFERENCES split_loads(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_split_loads_order ON split_loads(order_id);
CREATE INDEX IF NOT EXISTS idx_deductions_split_load ON cross_driver_freight_deductions(split_load_id);

-- Step 3: Update existing split load deductions to link to split_loads
-- This matches deductions to split loads by order_id and comment pattern
UPDATE cross_driver_freight_deductions cdfd
SET split_load_id = sl.id
FROM split_loads sl
WHERE cdfd.comment LIKE '%split load%'
  AND cdfd.is_manual = true
  AND cdfd.order_id = sl.order_id
  AND cdfd.split_load_id IS NULL;

-- Note: We keep pending_split_loads table for now for backward compatibility
-- but new code should use split_loads

