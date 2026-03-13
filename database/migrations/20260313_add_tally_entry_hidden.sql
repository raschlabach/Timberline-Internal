-- Add tally_entry_hidden flag to lumber_loads
-- Allows hiding loads from the tally entry page when tallies are not expected
ALTER TABLE lumber_loads
ADD COLUMN IF NOT EXISTS tally_entry_hidden BOOLEAN NOT NULL DEFAULT FALSE;
