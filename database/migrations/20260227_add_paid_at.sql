-- Add paid_at timestamp to track when a lumber load was marked as paid
ALTER TABLE lumber_loads ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- Backfill existing paid loads with their updated_at as a best-effort paid date
UPDATE lumber_loads SET paid_at = updated_at WHERE is_paid = TRUE AND paid_at IS NULL;
