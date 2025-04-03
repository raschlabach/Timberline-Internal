-- Add color and freight data support to order presets
ALTER TABLE order_presets
ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#808080',
ADD COLUMN freight_type VARCHAR(20) CHECK (freight_type IN ('skidsVinyl', 'footage')),
ADD COLUMN footage INTEGER,
ADD COLUMN comments TEXT,
ADD COLUMN freight_quote DECIMAL(10, 2),
ADD COLUMN is_rush BOOLEAN DEFAULT FALSE,
ADD COLUMN needs_attention BOOLEAN DEFAULT FALSE;

-- Create table for preset skids
CREATE TABLE preset_skids (
    id SERIAL PRIMARY KEY,
    preset_id INTEGER NOT NULL REFERENCES order_presets(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('skid', 'vinyl')),
    width INTEGER NOT NULL,
    length INTEGER NOT NULL,
    square_footage INTEGER NOT NULL,
    number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_preset_skids_preset ON preset_skids(preset_id);

-- Create table for preset links
CREATE TABLE preset_links (
    id SERIAL PRIMARY KEY,
    preset_id INTEGER NOT NULL REFERENCES order_presets(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_preset_links_preset ON preset_links(preset_id);

-- Add update timestamp triggers
CREATE TRIGGER update_timestamp BEFORE UPDATE ON preset_skids
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp BEFORE UPDATE ON preset_links
    FOR EACH ROW EXECUTE FUNCTION update_timestamp(); 