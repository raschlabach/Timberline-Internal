-- Fuel Tank Tracking System
-- Track a 1000-gallon fuel tank at the warehouse, driver fill-ups, and gas company refills

-- Trucks that can be assigned to drivers
CREATE TABLE IF NOT EXISTS fuel_trucks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fuel_trucks_driver_id ON fuel_trucks(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_trucks_active ON fuel_trucks(is_active);

-- Gas company refilling the 1000-gallon tank (level goes UP)
CREATE TABLE IF NOT EXISTS fuel_tank_refills (
    id SERIAL PRIMARY KEY,
    refill_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gallons DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fuel_tank_refills_date ON fuel_tank_refills(refill_date);

-- Drivers filling their trucks from the tank (level goes DOWN)
CREATE TABLE IF NOT EXISTS fuel_truck_fillups (
    id SERIAL PRIMARY KEY,
    fillup_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    truck_id INTEGER NOT NULL REFERENCES fuel_trucks(id),
    driver_id INTEGER REFERENCES users(id),
    mileage INTEGER NOT NULL,
    gallons DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fuel_truck_fillups_date ON fuel_truck_fillups(fillup_date);
CREATE INDEX IF NOT EXISTS idx_fuel_truck_fillups_truck_id ON fuel_truck_fillups(truck_id);
CREATE INDEX IF NOT EXISTS idx_fuel_truck_fillups_driver_id ON fuel_truck_fillups(driver_id);

-- Triggers
CREATE TRIGGER update_timestamp_fuel_trucks BEFORE UPDATE ON fuel_trucks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp_fuel_tank_refills BEFORE UPDATE ON fuel_tank_refills FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp_fuel_truck_fillups BEFORE UPDATE ON fuel_truck_fillups FOR EACH ROW EXECUTE FUNCTION update_timestamp();
