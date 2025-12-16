-- Migration to add calculated pay values to truckloads table
-- These values are calculated and saved from the Invoice page to ensure consistency

ALTER TABLE truckloads
ADD COLUMN IF NOT EXISTS calculated_load_value DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS calculated_driver_pay DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP;

-- Add comments for clarity
COMMENT ON COLUMN truckloads.calculated_load_value IS 'Load value calculated from quotes, deductions, and additions (saved from Invoice page)';
COMMENT ON COLUMN truckloads.calculated_driver_pay IS 'Final driver pay calculated from load value and deductions (saved from Invoice page)';
COMMENT ON COLUMN truckloads.calculated_at IS 'Timestamp when the calculated values were last saved';

