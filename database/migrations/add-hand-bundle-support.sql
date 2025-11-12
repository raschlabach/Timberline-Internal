-- Migration to add hand bundle support to freight_items table
-- This allows tracking small hand bundles that don't count toward footage

-- Update the CHECK constraint to include 'hand_bundle' as a valid type
ALTER TABLE freight_items 
DROP CONSTRAINT IF EXISTS freight_items_type_check;

ALTER TABLE freight_items 
ADD CONSTRAINT freight_items_type_check 
CHECK (type IN ('skid', 'vinyl', 'footage', 'hand_bundle'));

-- Add a comment to document the hand_bundle type
COMMENT ON COLUMN freight_items.type IS 'Type of freight item: skid, vinyl, footage, or hand_bundle';
