-- Add layout_type column to trailer_layouts table
BEGIN;

-- Add layout_type column with default value 'delivery'
ALTER TABLE trailer_layouts
ADD COLUMN layout_type VARCHAR(20) NOT NULL DEFAULT 'delivery'
CHECK (layout_type IN ('delivery', 'pickup'));

-- Create index for faster lookups by layout type
CREATE INDEX idx_trailer_layouts_type ON trailer_layouts(layout_type);

-- Add composite index for truckload + type lookups
CREATE INDEX idx_trailer_layouts_truckload_type ON trailer_layouts(truckload_id, layout_type);

COMMIT; 