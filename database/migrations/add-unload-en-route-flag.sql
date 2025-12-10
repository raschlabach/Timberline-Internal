-- Add unload_en_route flag to orders table
-- This flag indicates that the order should be unloaded while en route (on the way in)

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS unload_en_route BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_unload_en_route ON orders(unload_en_route);

