-- External Fuel Tracking (Red Rover / Voyager fuel card imports)

-- Add vehicle description mapping to fuel_trucks for Voyager report matching
ALTER TABLE fuel_trucks ADD COLUMN IF NOT EXISTS voyager_vehicle_description VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_fuel_trucks_voyager_desc ON fuel_trucks(voyager_vehicle_description);

-- Track each uploaded Voyager PDF report
CREATE TABLE IF NOT EXISTS fuel_report_imports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(500) NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fuel_report_imports_dates ON fuel_report_imports(date_from, date_to);

-- Individual transactions from Voyager reports
CREATE TABLE IF NOT EXISTS fuel_external_transactions (
    id SERIAL PRIMARY KEY,
    import_id INTEGER REFERENCES fuel_report_imports(id) ON DELETE CASCADE,
    truck_id INTEGER REFERENCES fuel_trucks(id),
    transaction_date DATE NOT NULL,
    merchant_name VARCHAR(200),
    merchant_city VARCHAR(100),
    state VARCHAR(10),
    invoice_number VARCHAR(50),
    odometer INTEGER,
    product_code VARCHAR(20),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(10, 4) NOT NULL,
    trans_amount DECIMAL(10, 2) NOT NULL,
    vehicle_description VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fuel_ext_txn_date ON fuel_external_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fuel_ext_txn_truck ON fuel_external_transactions(truck_id);
CREATE INDEX IF NOT EXISTS idx_fuel_ext_txn_import ON fuel_external_transactions(import_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_ext_txn_unique ON fuel_external_transactions(invoice_number, vehicle_description);

-- Triggers
CREATE TRIGGER update_timestamp_fuel_external_transactions BEFORE UPDATE ON fuel_external_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
