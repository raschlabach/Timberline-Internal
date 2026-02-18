-- Add submitted_by column to driver_hours to track who entered the hours
-- and truckload_id to link hours to specific loads
ALTER TABLE driver_hours 
  ADD COLUMN IF NOT EXISTS is_driver_submitted BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS truckload_id INTEGER REFERENCES truckloads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_driver_hours_truckload_id ON driver_hours(truckload_id);
CREATE INDEX IF NOT EXISTS idx_driver_hours_is_driver_submitted ON driver_hours(is_driver_submitted);
