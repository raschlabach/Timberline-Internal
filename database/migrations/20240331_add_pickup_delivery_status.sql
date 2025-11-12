-- Add pickup and delivery status columns to skids and vinyl tables
BEGIN;

-- Add columns to skids table
ALTER TABLE skids
ADD COLUMN is_picked_up BOOLEAN DEFAULT FALSE,
ADD COLUMN is_delivered BOOLEAN DEFAULT FALSE;

-- Add columns to vinyl table
ALTER TABLE vinyl
ADD COLUMN is_picked_up BOOLEAN DEFAULT FALSE,
ADD COLUMN is_delivered BOOLEAN DEFAULT FALSE;

-- Add indexes for faster lookups
CREATE INDEX idx_skids_pickup_status ON skids(is_picked_up);
CREATE INDEX idx_skids_delivery_status ON skids(is_delivered);
CREATE INDEX idx_vinyl_pickup_status ON vinyl(is_picked_up);
CREATE INDEX idx_vinyl_delivery_status ON vinyl(is_delivered);

COMMIT; 