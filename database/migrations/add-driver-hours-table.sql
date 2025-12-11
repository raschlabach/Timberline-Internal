-- Migration to add driver_hours table for storing driver hours worked outside of loads

CREATE TABLE IF NOT EXISTS driver_hours (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT,
    hours DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_hours_driver ON driver_hours(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_hours_date ON driver_hours(date);

-- Add trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_driver_hours_timestamp ON driver_hours;
CREATE TRIGGER update_driver_hours_timestamp
BEFORE UPDATE ON driver_hours
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

