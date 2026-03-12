-- Cabinet Orders
-- Stores processed Nature's Blend order uploads so they can be viewed later
-- Uses JSONB for the processed sheet/section/row data since it's read-only after upload

CREATE TABLE IF NOT EXISTS cabinet_orders (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  po_numbers TEXT[] DEFAULT '{}',
  due_date VARCHAR(50),
  processed_sheets JSONB NOT NULL DEFAULT '[]',
  special_results JSONB NOT NULL DEFAULT '[]',
  upload_combos JSONB NOT NULL DEFAULT '[]',
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabinet_orders_created_at ON cabinet_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cabinet_orders_is_done ON cabinet_orders(is_done);
