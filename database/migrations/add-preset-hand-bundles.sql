-- Migration to add hand bundle support to order presets

-- Create table for preset hand bundles
CREATE TABLE IF NOT EXISTS preset_hand_bundles (
    id SERIAL PRIMARY KEY,
    preset_id INTEGER NOT NULL REFERENCES order_presets(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL DEFAULT 'Hand Bundle',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_preset_hand_bundles_preset ON preset_hand_bundles(preset_id);

-- Add update timestamp trigger
CREATE TRIGGER update_timestamp BEFORE UPDATE ON preset_hand_bundles
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
