-- RNR Lumber Pickups: Bridges the RNR lumber tracker with Timberline logistics
-- Allows auto-entry of pickup loads from the RNR side into the Timberline order system

-- Track which Timberline order was created from a lumber load
ALTER TABLE lumber_loads ADD COLUMN IF NOT EXISTS timberline_order_id INTEGER REFERENCES orders(id);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_timberline_order ON lumber_loads(timberline_order_id);

-- Persistent mapping: lumber supplier → Timberline customer
CREATE TABLE IF NOT EXISTS rnr_supplier_customer_map (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES lumber_suppliers(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_rnr_supplier_customer_map_supplier ON rnr_supplier_customer_map(supplier_id);

DROP TRIGGER IF EXISTS update_timestamp ON rnr_supplier_customer_map;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON rnr_supplier_customer_map FOR EACH ROW EXECUTE FUNCTION update_timestamp();
