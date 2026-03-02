-- Freight Shipping Orders
-- Simple order form with customer, PO, and skid details for printable shipping reports

CREATE TABLE IF NOT EXISTS freight_orders (
  id SERIAL PRIMARY KEY,
  customer VARCHAR(255) NOT NULL,
  po_number VARCHAR(100),
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freight_orders_customer ON freight_orders(customer);
CREATE INDEX IF NOT EXISTS idx_freight_orders_po ON freight_orders(po_number);

CREATE TABLE IF NOT EXISTS freight_order_skids (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES freight_orders(id) ON DELETE CASCADE,
  skid_number VARCHAR(50),
  po_number VARCHAR(100),
  width DECIMAL(10, 4),
  length DECIMAL(10, 4),
  height DECIMAL(10, 4),
  weight DECIMAL(10, 2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freight_order_skids_order ON freight_order_skids(order_id);
