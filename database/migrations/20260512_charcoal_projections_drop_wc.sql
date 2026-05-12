-- Projections are raw charcoal not yet bagged, so they aren't WC or Standard yet.
-- Remove the is_walnut_creek distinction from projected skids.
ALTER TABLE charcoal_projected_skids DROP COLUMN IF EXISTS is_walnut_creek;
