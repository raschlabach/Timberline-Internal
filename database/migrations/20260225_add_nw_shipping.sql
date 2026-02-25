-- Northwest Shipping Reports
-- Archbold parts master list + shipping report forms with line items

-- Archbold Parts master table (item codes with dimensions)
CREATE TABLE IF NOT EXISTS archbold_parts (
  id SERIAL PRIMARY KEY,
  item_code VARCHAR(50) NOT NULL UNIQUE,
  width DECIMAL(10, 4),
  length DECIMAL(10, 4),
  used_for VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archbold_parts_item_code ON archbold_parts(item_code);

-- Northwest Shipping Reports (header)
CREATE TABLE IF NOT EXISTS nw_shipping_reports (
  id SERIAL PRIMARY KEY,
  northwest_po VARCHAR(100),
  archbold_po VARCHAR(100),
  delivery_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nw_shipping_reports_nw_po ON nw_shipping_reports(northwest_po);
CREATE INDEX IF NOT EXISTS idx_nw_shipping_reports_archbold_po ON nw_shipping_reports(archbold_po);

-- Northwest Shipping Report Line Items
CREATE TABLE IF NOT EXISTS nw_shipping_report_items (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES nw_shipping_reports(id) ON DELETE CASCADE,
  pallet_number VARCHAR(50),
  pallet_tag VARCHAR(50),
  archbold_part_id INTEGER REFERENCES archbold_parts(id),
  qty_per_skid INTEGER,
  skid_width DECIMAL(10, 4),
  skid_length DECIMAL(10, 4),
  skid_height DECIMAL(10, 4),
  skid_weight DECIMAL(10, 2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nw_report_items_report ON nw_shipping_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_nw_report_items_part ON nw_shipping_report_items(archbold_part_id);
