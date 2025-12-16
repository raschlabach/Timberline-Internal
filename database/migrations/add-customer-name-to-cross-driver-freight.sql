-- Migration to add customer_name column to cross_driver_freight_deductions table
-- This column stores the customer name for pickup/delivery in automatic deductions

ALTER TABLE cross_driver_freight_deductions
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Add comment for clarity
COMMENT ON COLUMN cross_driver_freight_deductions.customer_name IS 'Customer name for pickup/delivery (for automatic deductions)';

