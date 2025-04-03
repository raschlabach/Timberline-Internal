-- Fix the layout tables structure
BEGIN;

-- First ensure we're using the correct table structure from schema.sql
DROP TABLE IF EXISTS trailer_layout_items CASCADE;
DROP TABLE IF EXISTS trailer_layouts CASCADE;

-- Recreate the base tables as defined in schema.sql
CREATE TABLE trailer_layouts (
    id SERIAL PRIMARY KEY,
    truckload_id INTEGER NOT NULL REFERENCES truckloads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trailer_layout_items (
    id SERIAL PRIMARY KEY,
    trailer_layout_id INTEGER NOT NULL REFERENCES trailer_layouts(id),
    item_type VARCHAR(20) NOT NULL,
    item_id INTEGER NOT NULL,
    x_position INTEGER NOT NULL,
    y_position INTEGER NOT NULL,
    width INTEGER NOT NULL,
    length INTEGER NOT NULL,
    rotation INTEGER DEFAULT 0,
    customer_id INTEGER,
    customer_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create necessary indexes
CREATE INDEX idx_trailer_layouts_truckload ON trailer_layouts(truckload_id);
CREATE INDEX idx_layout_items_layout ON trailer_layout_items(trailer_layout_id);
CREATE INDEX idx_layout_items_position ON trailer_layout_items(x_position, y_position);
CREATE INDEX idx_layout_items_customer ON trailer_layout_items(customer_id);

-- Add update timestamp triggers
CREATE TRIGGER update_timestamp BEFORE UPDATE ON trailer_layouts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON trailer_layout_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

COMMIT; 