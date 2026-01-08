-- Add lumber_load_presets table for saving common load configurations
CREATE TABLE IF NOT EXISTS lumber_load_presets (
  id SERIAL PRIMARY KEY,
  preset_name VARCHAR(200) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES lumber_suppliers(id),
  supplier_location_id INTEGER REFERENCES lumber_supplier_locations(id),
  lumber_type VARCHAR(20),
  pickup_or_delivery VARCHAR(20),
  comments TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add lumber_load_preset_items table for preset item configurations
CREATE TABLE IF NOT EXISTS lumber_load_preset_items (
  id SERIAL PRIMARY KEY,
  preset_id INTEGER NOT NULL REFERENCES lumber_load_presets(id) ON DELETE CASCADE,
  species VARCHAR(100) NOT NULL,
  grade VARCHAR(100) NOT NULL,
  thickness VARCHAR(10) NOT NULL,
  estimated_footage DECIMAL(12,2),
  price DECIMAL(12,2),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lumber_load_presets_supplier ON lumber_load_presets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_lumber_load_presets_favorite ON lumber_load_presets(is_favorite);
CREATE INDEX IF NOT EXISTS idx_lumber_load_presets_created_by ON lumber_load_presets(created_by);
CREATE INDEX IF NOT EXISTS idx_lumber_load_preset_items_preset ON lumber_load_preset_items(preset_id);

-- Create trigger for updated_at
CREATE TRIGGER update_lumber_load_presets_updated_at
  BEFORE UPDATE ON lumber_load_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for presets with items
CREATE OR REPLACE VIEW lumber_load_presets_with_items AS
SELECT 
  p.*,
  s.name as supplier_name,
  sl.location_name as supplier_location_name,
  u.full_name as created_by_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', pi.id,
        'species', pi.species,
        'grade', pi.grade,
        'thickness', pi.thickness,
        'estimated_footage', pi.estimated_footage,
        'price', pi.price,
        'display_order', pi.display_order
      ) ORDER BY pi.display_order, pi.id
    ) FILTER (WHERE pi.id IS NOT NULL),
    '[]'::json
  ) as items
FROM lumber_load_presets p
LEFT JOIN lumber_suppliers s ON p.supplier_id = s.id
LEFT JOIN lumber_supplier_locations sl ON p.supplier_location_id = sl.id
LEFT JOIN users u ON p.created_by = u.id
LEFT JOIN lumber_load_preset_items pi ON p.id = pi.preset_id
GROUP BY p.id, s.name, sl.location_name, u.full_name
ORDER BY p.is_favorite DESC, s.name, p.preset_name;
