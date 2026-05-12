-- Charcoal Operations Module
-- Tracks wrapped charcoal skids, customer orders, and production projections

CREATE TABLE IF NOT EXISTS charcoal_customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_walnut_creek BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS charcoal_skids (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  wrapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wrapped_by_id TEXT NOT NULL,
  is_walnut_creek BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charcoal_skids_is_walnut_creek ON charcoal_skids (is_walnut_creek);
CREATE INDEX IF NOT EXISTS idx_charcoal_skids_wrapped_at ON charcoal_skids (wrapped_at);

CREATE TABLE IF NOT EXISTS charcoal_projected_skids (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  count INTEGER NOT NULL,
  ready_date DATE NOT NULL,
  is_walnut_creek BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charcoal_projected_skids_ready_date ON charcoal_projected_skids (ready_date);

CREATE TABLE IF NOT EXISTS charcoal_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id TEXT NOT NULL REFERENCES charcoal_customers(id),
  quantity INTEGER NOT NULL,
  due_date DATE,
  notes TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charcoal_orders_status_priority ON charcoal_orders (status, priority);
CREATE INDEX IF NOT EXISTS idx_charcoal_orders_created_at ON charcoal_orders (created_at);
CREATE INDEX IF NOT EXISTS idx_charcoal_orders_customer_id ON charcoal_orders (customer_id);
