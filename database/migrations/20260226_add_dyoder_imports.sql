-- D Yoder Hardwoods import system
-- Stores parsed Excel data from D Yoder Hardwoods shipment batch reports
-- Allows converting import items into orders and assigning to truckloads

CREATE TABLE IF NOT EXISTS dyoder_imports (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    batch_number VARCHAR(50),
    ship_from TEXT,
    ship_to_state VARCHAR(10),
    total_items INTEGER DEFAULT 0,
    total_weight DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dyoder_imports_status ON dyoder_imports(status);
CREATE INDEX IF NOT EXISTS idx_dyoder_imports_batch ON dyoder_imports(batch_number);

CREATE TABLE IF NOT EXISTS dyoder_import_items (
    id SERIAL PRIMARY KEY,
    import_id INTEGER NOT NULL REFERENCES dyoder_imports(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    special_tops TEXT,
    total_bf DECIMAL(10,2) DEFAULT 0,
    lineal_trailer_ft DECIMAL(10,2) DEFAULT 0,
    lineal_skid_ft DECIMAL(10,2) DEFAULT 0,
    skid_count INTEGER DEFAULT 0,
    weight DECIMAL(10,2) DEFAULT 0,
    ship_date DATE,
    freight_quote DECIMAL(10,2) DEFAULT 0,
    customer_matched BOOLEAN DEFAULT FALSE,
    matched_customer_id INTEGER REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'pending',
    order_id INTEGER REFERENCES orders(id),
    truckload_id INTEGER REFERENCES truckloads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dyoder_items_import ON dyoder_import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_dyoder_items_status ON dyoder_import_items(status);
CREATE INDEX IF NOT EXISTS idx_dyoder_items_customer ON dyoder_import_items(matched_customer_id);

-- Persistent D Yoder customer name -> customer mappings for auto-matching
CREATE TABLE IF NOT EXISTS dyoder_customer_map (
    id SERIAL PRIMARY KEY,
    dyoder_name TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dyoder_customer_map_name ON dyoder_customer_map(dyoder_name);

DROP TRIGGER IF EXISTS update_timestamp ON dyoder_imports;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON dyoder_imports FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_timestamp ON dyoder_import_items;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON dyoder_import_items FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_timestamp ON dyoder_customer_map;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON dyoder_customer_map FOR EACH ROW EXECUTE FUNCTION update_timestamp();
