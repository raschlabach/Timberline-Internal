-- Make pack_id, length, and tally_board_feet nullable
-- This allows creating empty packs that can be filled in later

ALTER TABLE lumber_packs ALTER COLUMN pack_id DROP NOT NULL;
ALTER TABLE lumber_packs ALTER COLUMN length DROP NOT NULL;
ALTER TABLE lumber_packs ALTER COLUMN tally_board_feet DROP NOT NULL;
