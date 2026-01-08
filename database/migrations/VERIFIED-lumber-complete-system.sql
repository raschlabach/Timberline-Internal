-- ============================================================================
-- VERIFIED LUMBER TRACKER COMPLETE SYSTEM
-- All migrations consolidated with proper constraints
-- ============================================================================

-- ============================================================================
-- 1. SUPPLIERS AND LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_suppliers_name ON lumber_suppliers(name);
CREATE INDEX IF NOT EXISTS idx_lumber_suppliers_active ON lumber_suppliers(is_active);

CREATE TABLE IF NOT EXISTS lumber_supplier_locations (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES lumber_suppliers(id) ON DELETE CASCADE,
    location_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    phone_number_1 VARCHAR(20),
    phone_number_2 VARCHAR(20),
    notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_supplier_locations_supplier ON lumber_supplier_locations(supplier_id);

-- ============================================================================
-- 2. DRIVERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_drivers_name ON lumber_drivers(name);
CREATE INDEX IF NOT EXISTS idx_lumber_drivers_active ON lumber_drivers(is_active);

-- ============================================================================
-- 3. LOADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_loads (
    id SERIAL PRIMARY KEY,
    load_id VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES lumber_suppliers(id),
    supplier_location_id INTEGER REFERENCES lumber_supplier_locations(id),
    
    lumber_type VARCHAR(50),
    pickup_or_delivery VARCHAR(20),
    
    estimated_delivery_date DATE,
    comments TEXT,
    
    actual_arrival_date DATE,
    pickup_number VARCHAR(100),
    plant VARCHAR(100),
    pickup_date DATE,
    invoice_number VARCHAR(100),
    invoice_total DECIMAL(10, 2),
    invoice_date DATE,
    
    driver_id INTEGER REFERENCES lumber_drivers(id),
    assigned_pickup_date DATE,
    
    entered_in_quickbooks BOOLEAN DEFAULT FALSE,
    is_paid BOOLEAN DEFAULT FALSE,
    
    load_quality INTEGER,
    all_packs_tallied BOOLEAN DEFAULT FALSE,
    all_packs_finished BOOLEAN DEFAULT FALSE,
    
    po_generated BOOLEAN DEFAULT FALSE,
    po_generated_at TIMESTAMP,
    
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_load_id ON lumber_loads(load_id);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_supplier ON lumber_loads(supplier_id);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_driver ON lumber_loads(driver_id);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_arrival ON lumber_loads(actual_arrival_date);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_tallied ON lumber_loads(all_packs_tallied);
CREATE INDEX IF NOT EXISTS idx_lumber_loads_finished ON lumber_loads(all_packs_finished);

-- ============================================================================
-- 4. LOAD ITEMS (Species/Grade/Thickness combinations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_load_items (
    id SERIAL PRIMARY KEY,
    load_id INTEGER NOT NULL REFERENCES lumber_loads(id) ON DELETE CASCADE,
    species VARCHAR(100) NOT NULL,
    grade VARCHAR(100) NOT NULL,
    thickness VARCHAR(10) NOT NULL,
    estimated_footage DECIMAL(12, 2),
    actual_footage DECIMAL(12, 2),
    price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_load_items_load ON lumber_load_items(load_id);
CREATE INDEX IF NOT EXISTS idx_lumber_load_items_species ON lumber_load_items(species);
CREATE INDEX IF NOT EXISTS idx_lumber_load_items_grade ON lumber_load_items(grade);
CREATE INDEX IF NOT EXISTS idx_lumber_load_items_thickness ON lumber_load_items(thickness);

-- ============================================================================
-- 5. LOAD DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_load_documents (
    id SERIAL PRIMARY KEY,
    load_id INTEGER NOT NULL REFERENCES lumber_loads(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    document_type VARCHAR(50),
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_load_documents_load ON lumber_load_documents(load_id);

-- ============================================================================
-- 6. PACKS (with UNIQUE constraint to prevent duplicates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_packs (
    id SERIAL PRIMARY KEY,
    pack_id BIGINT NOT NULL,
    load_id INTEGER NOT NULL REFERENCES lumber_loads(id) ON DELETE CASCADE,
    load_item_id INTEGER NOT NULL REFERENCES lumber_load_items(id) ON DELETE CASCADE,
    
    length INTEGER NOT NULL,
    tally_board_feet DECIMAL(10, 2) NOT NULL,
    
    actual_board_feet DECIMAL(10, 2),
    rip_yield DECIMAL(5, 2),
    rip_comments TEXT,
    is_finished BOOLEAN DEFAULT FALSE,
    finished_at TIMESTAMP,
    
    operator_id INTEGER REFERENCES users(id),
    stacker_1_id INTEGER REFERENCES users(id),
    stacker_2_id INTEGER REFERENCES users(id),
    stacker_3_id INTEGER REFERENCES users(id),
    stacker_4_id INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- CRITICAL: Prevent duplicate pack_ids within a load
    CONSTRAINT unique_pack_per_load UNIQUE (load_id, pack_id)
);
CREATE INDEX IF NOT EXISTS idx_lumber_packs_pack_id ON lumber_packs(pack_id);
CREATE INDEX IF NOT EXISTS idx_lumber_packs_load ON lumber_packs(load_id);
CREATE INDEX IF NOT EXISTS idx_lumber_packs_load_item ON lumber_packs(load_item_id);
CREATE INDEX IF NOT EXISTS idx_lumber_packs_finished ON lumber_packs(is_finished);
CREATE INDEX IF NOT EXISTS idx_lumber_packs_finished_at ON lumber_packs(finished_at);
CREATE INDEX IF NOT EXISTS idx_lumber_packs_operator ON lumber_packs(operator_id);

-- ============================================================================
-- 7. WORK SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_work_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_hours DECIMAL(5, 2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
    ) STORED,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_work_sessions_user ON lumber_work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lumber_work_sessions_date ON lumber_work_sessions(work_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lumber_work_sessions_unique ON lumber_work_sessions(user_id, work_date);

-- ============================================================================
-- 8. BONUS PARAMETERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_bonus_parameters (
    id SERIAL PRIMARY KEY,
    bf_min DECIMAL(10, 2) NOT NULL,
    bf_max DECIMAL(10, 2) NOT NULL,
    bonus_amount DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. TRUCKING NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_trucking_notes (
    id SERIAL PRIMARY KEY,
    note_text TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_trucking_notes_created_at ON lumber_trucking_notes(created_at DESC);

-- ============================================================================
-- 10. REFERENCE DATA (Species and Grades)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_species (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_species_name ON lumber_species(name);
CREATE INDEX IF NOT EXISTS idx_lumber_species_active ON lumber_species(is_active);

CREATE TABLE IF NOT EXISTS lumber_grades (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_grades_name ON lumber_grades(name);
CREATE INDEX IF NOT EXISTS idx_lumber_grades_active ON lumber_grades(is_active);

-- Insert common species
INSERT INTO lumber_species (name, display_order) VALUES
  ('Cherry', 1),
  ('Hard Maple', 2),
  ('Soft Maple', 3),
  ('Red Oak', 4),
  ('White Oak', 5),
  ('Walnut', 6),
  ('Ash', 7),
  ('Hickory', 8),
  ('Poplar', 9)
ON CONFLICT (name) DO NOTHING;

-- Insert common grades
INSERT INTO lumber_grades (name, display_order) VALUES
  ('FAS', 1),
  ('1C', 2),
  ('2C', 3),
  ('Select', 4),
  ('1 & 2', 5),
  ('Com', 6)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 11. LOAD ID RANGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS lumber_load_id_ranges (
  id SERIAL PRIMARY KEY,
  range_name VARCHAR(100) NOT NULL,
  start_range INTEGER NOT NULL,
  end_range INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_range CHECK (end_range > start_range)
);
CREATE INDEX IF NOT EXISTS idx_lumber_load_id_ranges_active ON lumber_load_id_ranges(is_active);

-- Insert default range
INSERT INTO lumber_load_id_ranges (range_name, start_range, end_range, is_active)
VALUES ('Default Range', 1000, 9999, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 12. PRESETS
-- ============================================================================

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
CREATE INDEX IF NOT EXISTS idx_lumber_load_presets_supplier ON lumber_load_presets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_lumber_load_presets_favorite ON lumber_load_presets(is_favorite);
CREATE INDEX IF NOT EXISTS idx_lumber_load_presets_created_by ON lumber_load_presets(created_by);

CREATE TABLE IF NOT EXISTS lumber_load_preset_items (
  id SERIAL PRIMARY KEY,
  preset_id INTEGER NOT NULL REFERENCES lumber_load_presets(id) ON DELETE CASCADE,
  species VARCHAR(100) NOT NULL,
  grade VARCHAR(100) NOT NULL,
  thickness VARCHAR(10) NOT NULL,
  estimated_footage DECIMAL(12, 2),
  price DECIMAL(12, 2),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lumber_load_preset_items_preset ON lumber_load_preset_items(preset_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Ensure the function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_lumber_suppliers_updated_at ON lumber_suppliers;
CREATE TRIGGER update_lumber_suppliers_updated_at BEFORE UPDATE ON lumber_suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_supplier_locations_updated_at ON lumber_supplier_locations;
CREATE TRIGGER update_lumber_supplier_locations_updated_at BEFORE UPDATE ON lumber_supplier_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_drivers_updated_at ON lumber_drivers;
CREATE TRIGGER update_lumber_drivers_updated_at BEFORE UPDATE ON lumber_drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_loads_updated_at ON lumber_loads;
CREATE TRIGGER update_lumber_loads_updated_at BEFORE UPDATE ON lumber_loads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_packs_updated_at ON lumber_packs;
CREATE TRIGGER update_lumber_packs_updated_at BEFORE UPDATE ON lumber_packs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_work_sessions_updated_at ON lumber_work_sessions;
CREATE TRIGGER update_lumber_work_sessions_updated_at BEFORE UPDATE ON lumber_work_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_bonus_parameters_updated_at ON lumber_bonus_parameters;
CREATE TRIGGER update_lumber_bonus_parameters_updated_at BEFORE UPDATE ON lumber_bonus_parameters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_trucking_notes_updated_at ON lumber_trucking_notes;
CREATE TRIGGER update_lumber_trucking_notes_updated_at BEFORE UPDATE ON lumber_trucking_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_species_updated_at ON lumber_species;
CREATE TRIGGER update_lumber_species_updated_at BEFORE UPDATE ON lumber_species FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_grades_updated_at ON lumber_grades;
CREATE TRIGGER update_lumber_grades_updated_at BEFORE UPDATE ON lumber_grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_load_id_ranges_updated_at ON lumber_load_id_ranges;
CREATE TRIGGER update_lumber_load_id_ranges_updated_at BEFORE UPDATE ON lumber_load_id_ranges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lumber_load_presets_updated_at ON lumber_load_presets;
CREATE TRIGGER update_lumber_load_presets_updated_at BEFORE UPDATE ON lumber_load_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

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

-- ============================================================================
-- COMPLETE! All tables, indexes, constraints, triggers, and views created
-- ============================================================================
