-- Create truckload_layouts table
CREATE TABLE IF NOT EXISTS truckload_layouts (
    id SERIAL PRIMARY KEY,
    truckload_id INTEGER NOT NULL REFERENCES truckloads(id) ON DELETE CASCADE,
    skid_id INTEGER,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    length INTEGER NOT NULL,
    item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('skid', 'vinyl')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_skid_id_requirement CHECK (
        (item_type = 'skid' AND skid_id IS NOT NULL) OR
        (item_type = 'vinyl')
    )
);

-- Create index on truckload_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_truckload_layouts_truckload_id ON truckload_layouts(truckload_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_truckload_layouts_updated_at
    BEFORE UPDATE ON truckload_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
