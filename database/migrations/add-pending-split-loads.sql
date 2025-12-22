-- Table to store split load configuration when only one assignment exists
CREATE TABLE IF NOT EXISTS pending_split_loads (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  existing_assignment_type VARCHAR(20) NOT NULL, -- 'pickup' or 'delivery'
  existing_assignment_id INTEGER NOT NULL REFERENCES truckload_order_assignments(id) ON DELETE CASCADE,
  misc_value DECIMAL(10, 2) NOT NULL,
  full_quote_assignment VARCHAR(20) NOT NULL, -- 'pickup' or 'delivery'
  full_quote_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay', -- 'load_value' or 'driver_pay'
  misc_applies_to VARCHAR(20) NOT NULL DEFAULT 'driver_pay', -- 'load_value' or 'driver_pay'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id)
);

CREATE INDEX idx_pending_split_loads_order ON pending_split_loads(order_id);
CREATE INDEX idx_pending_split_loads_assignment ON pending_split_loads(existing_assignment_id);

