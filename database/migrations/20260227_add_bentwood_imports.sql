-- Bentwood Solutions weekly import system
-- Stores parsed Excel data from Bentwood Solutions pickup confirmations
-- Allows converting import items into orders and assigning to truckloads

CREATE TABLE IF NOT EXISTS bentwood_imports (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    week_label VARCHAR(100),
    week_date DATE,
    total_items INTEGER DEFAULT 0,
    total_skids INTEGER DEFAULT 0,
    total_bundles INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bentwood_imports_status ON bentwood_imports(status);
CREATE INDEX IF NOT EXISTS idx_bentwood_imports_week_date ON bentwood_imports(week_date);

CREATE TABLE IF NOT EXISTS bentwood_import_items (
    id SERIAL PRIMARY KEY,
    import_id INTEGER NOT NULL REFERENCES bentwood_imports(id) ON DELETE CASCADE,
    ship_to_name TEXT NOT NULL,
    address TEXT,
    skid_qty INTEGER DEFAULT 0,
    is_bundle BOOLEAN DEFAULT FALSE,
    pickup_date DATE,
    delivery_date DATE,
    freight_quote DECIMAL(10,2) DEFAULT 0,
    customer_matched BOOLEAN DEFAULT FALSE,
    matched_customer_id INTEGER REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'pending',
    order_id INTEGER REFERENCES orders(id),
    truckload_id INTEGER REFERENCES truckloads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bentwood_items_import ON bentwood_import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_bentwood_items_status ON bentwood_import_items(status);
CREATE INDEX IF NOT EXISTS idx_bentwood_items_customer ON bentwood_import_items(matched_customer_id);

-- Persistent Bentwood customer name -> customer mappings for auto-matching
CREATE TABLE IF NOT EXISTS bentwood_customer_map (
    id SERIAL PRIMARY KEY,
    bentwood_name TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bentwood_customer_map_name ON bentwood_customer_map(bentwood_name);

DROP TRIGGER IF EXISTS update_timestamp ON bentwood_imports;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON bentwood_imports FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_timestamp ON bentwood_import_items;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON bentwood_import_items FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_timestamp ON bentwood_customer_map;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON bentwood_customer_map FOR EACH ROW EXECUTE FUNCTION update_timestamp();
