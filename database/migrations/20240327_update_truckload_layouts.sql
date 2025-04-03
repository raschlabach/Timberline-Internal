-- Drop existing table
DROP TABLE IF EXISTS truckload_layouts;

-- Recreate truckload_layouts table with better constraints
CREATE TABLE truckload_layouts (
    id SERIAL PRIMARY KEY,
    truckload_id INTEGER NOT NULL REFERENCES truckloads(id) ON DELETE CASCADE,
    skid_id INTEGER,
    position_x DECIMAL(10,2) NOT NULL,
    position_y DECIMAL(10,2) NOT NULL,
    width DECIMAL(10,2) NOT NULL,
    length DECIMAL(10,2) NOT NULL,
    item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('skid', 'vinyl')),
    customer_id INTEGER,
    customer_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_skid_id_requirement CHECK (
        (item_type = 'skid' AND skid_id IS NOT NULL) OR
        (item_type = 'vinyl' AND skid_id IS NULL)
    ),
    CONSTRAINT check_positive_dimensions CHECK (
        width > 0 AND length > 0
    ),
    CONSTRAINT check_valid_position CHECK (
        position_x >= 0 AND position_y >= 0
    )
);

-- Create index on truckload_id for faster lookups
CREATE INDEX idx_truckload_layouts_truckload_id ON truckload_layouts(truckload_id);

-- Create index on customer_id for faster customer-based queries
CREATE INDEX idx_truckload_layouts_customer_id ON truckload_layouts(customer_id);

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