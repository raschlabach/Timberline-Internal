-- Migration to update driver_pay_settings to have separate misc_driving_rate and maintenance_rate

-- First, add the new columns if they don't exist
ALTER TABLE driver_pay_settings 
  ADD COLUMN IF NOT EXISTS misc_driving_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS maintenance_rate DECIMAL(10, 2);

-- Migrate existing hourly_rate to misc_driving_rate
UPDATE driver_pay_settings 
SET misc_driving_rate = hourly_rate 
WHERE misc_driving_rate IS NULL;

-- Set default values for any null values
UPDATE driver_pay_settings 
SET misc_driving_rate = 30.00 
WHERE misc_driving_rate IS NULL;

UPDATE driver_pay_settings 
SET maintenance_rate = 30.00 
WHERE maintenance_rate IS NULL;

-- Make columns NOT NULL with defaults
ALTER TABLE driver_pay_settings 
  ALTER COLUMN misc_driving_rate SET DEFAULT 30.00,
  ALTER COLUMN misc_driving_rate SET NOT NULL,
  ALTER COLUMN maintenance_rate SET DEFAULT 30.00,
  ALTER COLUMN maintenance_rate SET NOT NULL;

-- Note: We keep hourly_rate for now to avoid breaking existing code during migration
-- It can be dropped later if needed

