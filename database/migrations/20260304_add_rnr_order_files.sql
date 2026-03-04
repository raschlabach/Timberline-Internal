-- Add file attachment support and extended status tracking to RNR orders

ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS in_quickbooks BOOLEAN DEFAULT false;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS in_quickbooks_at TIMESTAMP;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS sent_to_shop BOOLEAN DEFAULT false;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS sent_to_shop_at TIMESTAMP;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS original_file_url TEXT;
ALTER TABLE rnr_orders ADD COLUMN IF NOT EXISTS original_file_name TEXT;

CREATE TABLE IF NOT EXISTS rnr_order_files (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES rnr_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnr_order_files_order ON rnr_order_files(order_id);
