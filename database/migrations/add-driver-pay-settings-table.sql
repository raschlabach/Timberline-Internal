-- Migration to add driver_pay_settings table for storing driver pay configuration

CREATE TABLE IF NOT EXISTS driver_pay_settings (
    driver_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    load_percentage DECIMAL(5, 2) DEFAULT 30.00 NOT NULL,
    hourly_rate DECIMAL(10, 2) DEFAULT 30.00 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_pay_settings_driver ON driver_pay_settings(driver_id);

-- Add trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_driver_pay_settings_timestamp ON driver_pay_settings;
CREATE TRIGGER update_driver_pay_settings_timestamp
BEFORE UPDATE ON driver_pay_settings
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

