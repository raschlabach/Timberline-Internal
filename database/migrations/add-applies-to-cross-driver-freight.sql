-- Migration to add applies_to column to cross_driver_freight_deductions table
-- This column determines whether manual deductions/additions apply to load_value or driver_pay

ALTER TABLE cross_driver_freight_deductions
ADD COLUMN IF NOT EXISTS applies_to VARCHAR(20) DEFAULT 'driver_pay' CHECK (applies_to IN ('load_value', 'driver_pay'));

-- Set default for existing records
UPDATE cross_driver_freight_deductions
SET applies_to = 'driver_pay'
WHERE applies_to IS NULL;

