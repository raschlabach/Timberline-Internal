-- Migration to add is_addition column to cross_driver_freight_deductions table
-- This allows manual items to be marked as additions (positive) or deductions (negative)

ALTER TABLE cross_driver_freight_deductions
ADD COLUMN IF NOT EXISTS is_addition BOOLEAN DEFAULT FALSE;

-- Update existing manual items to default to false (deduction)
UPDATE cross_driver_freight_deductions
SET is_addition = FALSE
WHERE is_addition IS NULL;

