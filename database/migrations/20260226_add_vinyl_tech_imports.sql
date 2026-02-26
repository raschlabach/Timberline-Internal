-- Vinyl Tech weekly import system
-- Stores parsed Excel data from Vinyl Tech pickup confirmations
-- Allows converting import items into orders and assigning to truckloads

CREATE TABLE IF NOT EXISTS vinyl_tech_imports (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    week_label VARCHAR(100),
    week_date DATE,
    sheet_status VARCHAR(50),
    total_items INTEGER DEFAULT 0,
    items_with_freight INTEGER DEFAULT 0,
    total_weight DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vinyl_tech_imports_status ON vinyl_tech_imports(status);
CREATE INDEX IF NOT EXISTS idx_vinyl_tech_imports_week_date ON vinyl_tech_imports(week_date);

CREATE TABLE IF NOT EXISTS vinyl_tech_import_items (
    id SERIAL PRIMARY KEY,
    import_id INTEGER NOT NULL REFERENCES vinyl_tech_imports(id) ON DELETE CASCADE,
    vt_code VARCHAR(30),
    ship_to_name TEXT NOT NULL,
    skid_16ft INTEGER DEFAULT 0,
    skid_12ft INTEGER DEFAULT 0,
    skid_4x8 INTEGER DEFAULT 0,
    misc INTEGER DEFAULT 0,
    weight DECIMAL(10,2) DEFAULT 0,
    notes_on_skids TEXT,
    additional_notes TEXT,
    schedule_notes TEXT,
    has_freight BOOLEAN DEFAULT FALSE,
    customer_matched BOOLEAN DEFAULT FALSE,
    matched_customer_id INTEGER REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'pending',
    order_id INTEGER REFERENCES orders(id),
    truckload_id INTEGER REFERENCES truckloads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vt_items_import ON vinyl_tech_import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_vt_items_status ON vinyl_tech_import_items(status);
CREATE INDEX IF NOT EXISTS idx_vt_items_customer ON vinyl_tech_import_items(matched_customer_id);
CREATE INDEX IF NOT EXISTS idx_vt_items_has_freight ON vinyl_tech_import_items(has_freight);

DROP TRIGGER IF EXISTS update_timestamp ON vinyl_tech_imports;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON vinyl_tech_imports FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_timestamp ON vinyl_tech_import_items;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON vinyl_tech_import_items FOR EACH ROW EXECUTE FUNCTION update_timestamp();
