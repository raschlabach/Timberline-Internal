-- Add order field to order_presets table for custom ordering
ALTER TABLE order_presets
ADD COLUMN display_order INTEGER DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX idx_order_presets_display_order ON order_presets(display_order);

-- Update existing presets with incremental order values
UPDATE order_presets 
SET display_order = id 
WHERE display_order = 0;
