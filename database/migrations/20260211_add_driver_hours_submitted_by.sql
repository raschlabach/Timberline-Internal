-- Add columns for driver-submitted hours, load linking, and timer support
ALTER TABLE driver_hours 
  ADD COLUMN IF NOT EXISTS is_driver_submitted BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS truckload_id INTEGER REFERENCES truckloads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_driver_hours_truckload_id ON driver_hours(truckload_id);
CREATE INDEX IF NOT EXISTS idx_driver_hours_is_driver_submitted ON driver_hours(is_driver_submitted);
CREATE INDEX IF NOT EXISTS idx_driver_hours_started_at ON driver_hours(started_at) WHERE started_at IS NOT NULL;
