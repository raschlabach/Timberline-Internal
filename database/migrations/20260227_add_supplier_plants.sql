-- Formalize plant data for lumber suppliers
-- Plants are distinct facilities/locations within a supplier that may map to different Timberline customers

CREATE TABLE IF NOT EXISTS lumber_supplier_plants (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES lumber_suppliers(id) ON DELETE CASCADE,
    plant_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, plant_name)
);

CREATE INDEX IF NOT EXISTS idx_lumber_supplier_plants_supplier ON lumber_supplier_plants(supplier_id);

DROP TRIGGER IF EXISTS update_timestamp ON lumber_supplier_plants;
CREATE TRIGGER update_timestamp BEFORE UPDATE ON lumber_supplier_plants FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Add plant_id FK to lumber_loads (existing text plant column stays for historical data)
ALTER TABLE lumber_loads ADD COLUMN IF NOT EXISTS plant_id INTEGER REFERENCES lumber_supplier_plants(id);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_plant ON lumber_loads(plant_id);

-- Seed plants from existing distinct plant values per supplier
INSERT INTO lumber_supplier_plants (supplier_id, plant_name)
SELECT DISTINCT ll.supplier_id, TRIM(ll.plant)
FROM lumber_loads ll
WHERE ll.plant IS NOT NULL AND TRIM(ll.plant) != ''
ON CONFLICT (supplier_id, plant_name) DO NOTHING;

-- Backfill plant_id on existing loads that have a text plant value
UPDATE lumber_loads ll
SET plant_id = lsp.id
FROM lumber_supplier_plants lsp
WHERE ll.supplier_id = lsp.supplier_id
  AND LOWER(TRIM(ll.plant)) = LOWER(lsp.plant_name)
  AND ll.plant IS NOT NULL
  AND TRIM(ll.plant) != ''
  AND ll.plant_id IS NULL;

-- Update rnr_supplier_customer_map to support plant-specific mappings
-- Drop old unique constraint and add new one that includes plant_id
ALTER TABLE rnr_supplier_customer_map ADD COLUMN IF NOT EXISTS plant_id INTEGER REFERENCES lumber_supplier_plants(id);

-- Need to replace the unique constraint: supplier_id alone -> (supplier_id, plant_id) with nulls distinct
ALTER TABLE rnr_supplier_customer_map DROP CONSTRAINT IF EXISTS rnr_supplier_customer_map_supplier_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rnr_supplier_customer_map_unique
  ON rnr_supplier_customer_map (supplier_id, COALESCE(plant_id, 0));
