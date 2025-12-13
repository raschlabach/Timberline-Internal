-- Migration to add pay calculation method fields to truckloads table
-- This allows flexible driver pay calculation: automatic (default), hourly, or manual

ALTER TABLE truckloads
ADD COLUMN IF NOT EXISTS pay_calculation_method VARCHAR(20) DEFAULT 'automatic' CHECK (pay_calculation_method IN ('automatic', 'hourly', 'manual')),
ADD COLUMN IF NOT EXISTS pay_hours DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS pay_manual_amount DECIMAL(10, 2);

-- Update existing records to use 'automatic' method
UPDATE truckloads
SET pay_calculation_method = 'automatic'
WHERE pay_calculation_method IS NULL;

