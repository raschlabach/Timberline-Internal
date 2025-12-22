-- Migration to add order_id column to cross_driver_freight_deductions table
-- This allows us to differentiate between separate orders with identical attributes

ALTER TABLE cross_driver_freight_deductions
ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cross_driver_freight_order ON cross_driver_freight_deductions(order_id);

