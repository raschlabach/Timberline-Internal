-- Add is_favorite column to order_presets table
ALTER TABLE order_presets
ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;

-- Create index for better performance when filtering favorites
CREATE INDEX idx_order_presets_is_favorite ON order_presets(is_favorite);

-- Update existing presets to have is_favorite = false
UPDATE order_presets SET is_favorite = FALSE WHERE is_favorite IS NULL;
