-- Migration to add type column to driver_hours table

ALTER TABLE driver_hours 
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'misc_driving' NOT NULL;

-- Add check constraint to ensure type is valid
ALTER TABLE driver_hours 
  DROP CONSTRAINT IF EXISTS driver_hours_type_check;

ALTER TABLE driver_hours 
  ADD CONSTRAINT driver_hours_type_check 
  CHECK (type IN ('misc_driving', 'maintenance'));

-- Create index for type
CREATE INDEX IF NOT EXISTS idx_driver_hours_type ON driver_hours(type);

