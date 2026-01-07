-- Lumber Tracker System Database Schema
-- Complete system for tracking lumber loads, inventory, ripping, and bonuses

-- ============================================================================
-- SUPPLIERS AND LOCATIONS
-- ============================================================================

CREATE TABLE lumber_suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_suppliers_name ON lumber_suppliers(name);
CREATE INDEX idx_lumber_suppliers_active ON lumber_suppliers(is_active);

CREATE TABLE lumber_supplier_locations (
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
CREATE INDEX idx_lumber_supplier_locations_supplier ON lumber_supplier_locations(supplier_id);

-- ============================================================================
-- DRIVERS
-- ============================================================================

CREATE TABLE lumber_drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_drivers_name ON lumber_drivers(name);
CREATE INDEX idx_lumber_drivers_active ON lumber_drivers(is_active);

-- ============================================================================
-- LOADS
-- ============================================================================

CREATE TABLE lumber_loads (
    id SERIAL PRIMARY KEY,
    load_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., R-4276
    supplier_id INTEGER NOT NULL REFERENCES lumber_suppliers(id),
    supplier_location_id INTEGER REFERENCES lumber_supplier_locations(id),
    
    -- Type and delivery info
    lumber_type VARCHAR(50), -- 'dried' or 'green'
    pickup_or_delivery VARCHAR(20), -- 'pickup' or 'delivery'
    
    -- Estimated fields (at creation)
    estimated_delivery_date DATE,
    comments TEXT,
    
    -- Actual fields (when arrived)
    actual_arrival_date DATE,
    pickup_number VARCHAR(100),
    plant VARCHAR(100),
    pickup_date DATE,
    invoice_number VARCHAR(100),
    invoice_total DECIMAL(10, 2),
    invoice_date DATE,
    
    -- Trucking
    driver_id INTEGER REFERENCES lumber_drivers(id),
    assigned_pickup_date DATE,
    
    -- Invoice tracking
    entered_in_quickbooks BOOLEAN DEFAULT FALSE,
    is_paid BOOLEAN DEFAULT FALSE,
    
    -- Rip tracking
    load_quality INTEGER, -- 0-100
    all_packs_tallied BOOLEAN DEFAULT FALSE,
    all_packs_finished BOOLEAN DEFAULT FALSE,
    
    -- Status tracking
    po_generated BOOLEAN DEFAULT FALSE,
    po_generated_at TIMESTAMP,
    
    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_loads_load_id ON lumber_loads(load_id);
CREATE INDEX idx_lumber_loads_supplier ON lumber_loads(supplier_id);
CREATE INDEX idx_lumber_loads_arrival ON lumber_loads(actual_arrival_date);
CREATE INDEX idx_lumber_loads_tallied ON lumber_loads(all_packs_tallied);
CREATE INDEX idx_lumber_loads_finished ON lumber_loads(all_packs_finished);
CREATE INDEX idx_lumber_loads_paid ON lumber_loads(is_paid);

-- ============================================================================
-- LOAD ITEMS (Species/Grade/Thickness combinations within a load)
-- ============================================================================

CREATE TABLE lumber_load_items (
    id SERIAL PRIMARY KEY,
    load_id INTEGER NOT NULL REFERENCES lumber_loads(id) ON DELETE CASCADE,
    
    -- Species, grade, thickness
    species VARCHAR(100) NOT NULL,
    grade VARCHAR(100) NOT NULL,
    thickness VARCHAR(10) NOT NULL, -- '4/4', '5/4', '6/4', '7/4', '8/4'
    
    -- Estimated and actual footage
    estimated_footage DECIMAL(12, 2),
    actual_footage DECIMAL(12, 2),
    price DECIMAL(10, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_load_items_load ON lumber_load_items(load_id);
CREATE INDEX idx_lumber_load_items_species ON lumber_load_items(species);
CREATE INDEX idx_lumber_load_items_grade ON lumber_load_items(grade);
CREATE INDEX idx_lumber_load_items_thickness ON lumber_load_items(thickness);

-- ============================================================================
-- LOAD DOCUMENTS (PDFs and paperwork)
-- ============================================================================

CREATE TABLE lumber_load_documents (
    id SERIAL PRIMARY KEY,
    load_id INTEGER NOT NULL REFERENCES lumber_loads(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    document_type VARCHAR(50), -- 'invoice', 'po', 'paperwork', etc.
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_load_documents_load ON lumber_load_documents(load_id);

-- ============================================================================
-- PACKS (Individual packs within a load)
-- ============================================================================

CREATE TABLE lumber_packs (
    id SERIAL PRIMARY KEY,
    pack_id BIGINT NOT NULL, -- e.g., 78411
    load_id INTEGER NOT NULL REFERENCES lumber_loads(id) ON DELETE CASCADE,
    load_item_id INTEGER NOT NULL REFERENCES lumber_load_items(id) ON DELETE CASCADE,
    
    -- Pack tally (from supplier paperwork)
    length INTEGER NOT NULL, -- in feet (8, 10, 12, etc.)
    tally_board_feet DECIMAL(10, 2) NOT NULL,
    
    -- Rip data (entered by operator)
    actual_board_feet DECIMAL(10, 2),
    rip_yield DECIMAL(5, 2), -- percentage or decimal
    rip_comments TEXT,
    is_finished BOOLEAN DEFAULT FALSE,
    finished_at TIMESTAMP,
    
    -- Operator and stackers (assigned when finished)
    operator_id INTEGER REFERENCES users(id),
    stacker_1_id INTEGER REFERENCES users(id),
    stacker_2_id INTEGER REFERENCES users(id),
    stacker_3_id INTEGER REFERENCES users(id),
    stacker_4_id INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_packs_pack_id ON lumber_packs(pack_id);
CREATE INDEX idx_lumber_packs_load ON lumber_packs(load_id);
CREATE INDEX idx_lumber_packs_load_item ON lumber_packs(load_item_id);
CREATE INDEX idx_lumber_packs_finished ON lumber_packs(is_finished);
CREATE INDEX idx_lumber_packs_finished_at ON lumber_packs(finished_at);
CREATE INDEX idx_lumber_packs_operator ON lumber_packs(operator_id);

-- ============================================================================
-- WORK SESSIONS (Daily time tracking for operators/stackers)
-- ============================================================================

CREATE TABLE lumber_work_sessions (
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
CREATE INDEX idx_lumber_work_sessions_user ON lumber_work_sessions(user_id);
CREATE INDEX idx_lumber_work_sessions_date ON lumber_work_sessions(work_date);
CREATE UNIQUE INDEX idx_lumber_work_sessions_unique ON lumber_work_sessions(user_id, work_date);

-- ============================================================================
-- BONUS PARAMETERS (Configurable bonus tiers)
-- ============================================================================

CREATE TABLE lumber_bonus_parameters (
    id SERIAL PRIMARY KEY,
    bf_min INTEGER NOT NULL,
    bf_max INTEGER NOT NULL,
    bonus_amount DECIMAL(5, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_bonus_parameters_range ON lumber_bonus_parameters(bf_min, bf_max);
CREATE INDEX idx_lumber_bonus_parameters_active ON lumber_bonus_parameters(is_active);

-- ============================================================================
-- TRUCKING NOTES (For dispatcher)
-- ============================================================================

CREATE TABLE lumber_trucking_notes (
    id SERIAL PRIMARY KEY,
    note_text TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lumber_trucking_notes_created ON lumber_trucking_notes(created_at DESC);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for inventory calculation
CREATE OR REPLACE VIEW lumber_inventory_view AS
SELECT 
    li.species,
    li.grade,
    li.thickness,
    SUM(li.actual_footage) as total_actual_footage,
    SUM(COALESCE(finished_packs.finished_footage, 0)) as total_finished_footage,
    SUM(li.actual_footage) - SUM(COALESCE(finished_packs.finished_footage, 0)) as current_inventory
FROM lumber_load_items li
LEFT JOIN (
    SELECT 
        load_item_id,
        SUM(tally_board_feet) as finished_footage
    FROM lumber_packs
    WHERE is_finished = TRUE
    GROUP BY load_item_id
) finished_packs ON li.id = finished_packs.load_item_id
WHERE li.actual_footage IS NOT NULL
GROUP BY li.species, li.grade, li.thickness;

-- View for loads needing POs
CREATE OR REPLACE VIEW lumber_loads_needing_pos AS
SELECT 
    l.*,
    s.name as supplier_name
FROM lumber_loads l
JOIN lumber_suppliers s ON l.supplier_id = s.id
WHERE l.po_generated = FALSE
ORDER BY l.created_at;

-- View for incoming loads (created but not arrived)
CREATE OR REPLACE VIEW lumber_incoming_loads AS
SELECT 
    l.*,
    s.name as supplier_name,
    sl.location_name,
    sl.phone_number_1,
    sl.phone_number_2
FROM lumber_loads l
JOIN lumber_suppliers s ON l.supplier_id = s.id
LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
WHERE l.actual_arrival_date IS NULL
ORDER BY l.estimated_delivery_date, l.created_at;

-- View for loads needing invoice processing
CREATE OR REPLACE VIEW lumber_loads_for_invoice AS
SELECT 
    l.*,
    s.name as supplier_name
FROM lumber_loads l
JOIN lumber_suppliers s ON l.supplier_id = s.id
WHERE l.actual_arrival_date IS NOT NULL 
  AND l.is_paid = FALSE
ORDER BY l.actual_arrival_date;

-- View for loads needing tally entry
CREATE OR REPLACE VIEW lumber_loads_needing_tallies AS
SELECT 
    l.*,
    s.name as supplier_name
FROM lumber_loads l
JOIN lumber_suppliers s ON l.supplier_id = s.id
WHERE l.actual_arrival_date IS NOT NULL 
  AND l.all_packs_tallied = FALSE
ORDER BY l.actual_arrival_date;

-- View for loads in rip entry (tallied but not fully ripped)
CREATE OR REPLACE VIEW lumber_loads_for_rip_entry AS
SELECT 
    l.*,
    s.name as supplier_name
FROM lumber_loads l
JOIN lumber_suppliers s ON l.supplier_id = s.id
WHERE l.all_packs_tallied = TRUE 
  AND l.all_packs_finished = FALSE
ORDER BY l.actual_arrival_date;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lumber_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lumber_suppliers_updated_at BEFORE UPDATE ON lumber_suppliers
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_supplier_locations_updated_at BEFORE UPDATE ON lumber_supplier_locations
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_drivers_updated_at BEFORE UPDATE ON lumber_drivers
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_loads_updated_at BEFORE UPDATE ON lumber_loads
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_load_items_updated_at BEFORE UPDATE ON lumber_load_items
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_packs_updated_at BEFORE UPDATE ON lumber_packs
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_work_sessions_updated_at BEFORE UPDATE ON lumber_work_sessions
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_bonus_parameters_updated_at BEFORE UPDATE ON lumber_bonus_parameters
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_trucking_notes_updated_at BEFORE UPDATE ON lumber_trucking_notes
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default bonus parameters (from the image)
INSERT INTO lumber_bonus_parameters (bf_min, bf_max, bonus_amount, is_active) VALUES
(750, 900, 0.40, true),
(901, 1050, 0.60, true),
(1051, 1200, 0.80, true),
(1201, 1350, 1.00, true),
(1351, 1500, 1.20, true),
(1501, 1650, 1.40, true),
(1651, 1800, 1.60, true),
(1801, 1950, 1.80, true),
(1951, 2100, 2.00, true),
(2101, 2500, 2.20, true),
(2501, 10000, 2.20, true);
