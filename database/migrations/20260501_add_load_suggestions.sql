-- Load Suggestion System: Polygons, Groups, and matching
-- Standalone tool for suggested truckload building

-- Geographic zones drawn on the map
CREATE TABLE load_suggestion_polygons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    coordinates JSONB NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    match_on VARCHAR(20) NOT NULL DEFAULT 'delivery',
    max_footage INTEGER,
    max_stops INTEGER,
    only_unassigned_type VARCHAR(20),
    load_type_filter JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suggestion_polygons_active ON load_suggestion_polygons(is_active);

-- Named truckload group containers
CREATE TABLE load_suggestion_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    max_footage INTEGER,
    max_stops INTEGER,
    preferred_driver_id INTEGER REFERENCES drivers(user_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suggestion_groups_active ON load_suggestion_groups(is_active);

-- Many-to-many: which polygons feed into which groups
CREATE TABLE load_suggestion_group_polygons (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES load_suggestion_groups(id) ON DELETE CASCADE,
    polygon_id INTEGER NOT NULL REFERENCES load_suggestion_polygons(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, polygon_id)
);

CREATE INDEX idx_suggestion_gp_group ON load_suggestion_group_polygons(group_id);
CREATE INDEX idx_suggestion_gp_polygon ON load_suggestion_group_polygons(polygon_id);

-- Apply update_timestamp triggers
CREATE TRIGGER update_timestamp BEFORE UPDATE ON load_suggestion_polygons FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON load_suggestion_groups FOR EACH ROW EXECUTE FUNCTION update_timestamp();
