-- Migration to add cross_driver_freight_deductions table for storing freight handled by other drivers

CREATE TABLE IF NOT EXISTS cross_driver_freight_deductions (
    id SERIAL PRIMARY KEY,
    truckload_id INTEGER NOT NULL REFERENCES truckloads(id) ON DELETE CASCADE,
    driver_name VARCHAR(100),
    date DATE,
    action VARCHAR(20) CHECK (action IN ('Picked up', 'Delivered')),
    footage DECIMAL(10, 2) DEFAULT 0,
    dimensions TEXT,
    deduction DECIMAL(10, 2) DEFAULT 0,
    is_manual BOOLEAN DEFAULT FALSE,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cross_driver_freight_truckload ON cross_driver_freight_deductions(truckload_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_cross_driver_freight_timestamp
BEFORE UPDATE ON cross_driver_freight_deductions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

