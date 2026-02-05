-- Add actual_footage_entered_at timestamp to lumber_load_items
-- This tracks when the actual footage was first entered (when load moved to inventory)

ALTER TABLE lumber_load_items
ADD COLUMN IF NOT EXISTS actual_footage_entered_at TIMESTAMP;

-- Create an index for querying by this date
CREATE INDEX IF NOT EXISTS idx_lumber_load_items_footage_entered 
ON lumber_load_items(actual_footage_entered_at);

-- For existing records that have actual_footage set, backfill with updated_at
UPDATE lumber_load_items
SET actual_footage_entered_at = updated_at
WHERE actual_footage IS NOT NULL 
  AND actual_footage_entered_at IS NULL;
