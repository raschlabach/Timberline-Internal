-- RNR Office Module: Master Parts, Orders, Quotes, Machines, Pricing
-- Phase 1 migration - creates all foundation tables

-- ==========================================
-- REFERENCE TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS rnr_species (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rnr_product_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL,
  default_routing_id INTEGER,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS rnr_profiles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  product_type_id INTEGER REFERENCES rnr_product_types(id),
  is_active BOOLEAN DEFAULT true
);

-- ==========================================
-- MASTER PARTS
-- ==========================================

CREATE TABLE IF NOT EXISTS rnr_parts (
  id SERIAL PRIMARY KEY,
  rnr_part_number VARCHAR(50),
  customer_part_number VARCHAR(100),
  customer_id INTEGER REFERENCES customers(id),
  description TEXT,
  species_id INTEGER REFERENCES rnr_species(id),
  product_type_id INTEGER REFERENCES rnr_product_types(id),
  profile_id INTEGER REFERENCES rnr_profiles(id),
  thickness DECIMAL(10,6),
  width DECIMAL(10,4),
  length DECIMAL(10,4),
  board_feet DECIMAL(10,4),
  lineal_feet DECIMAL(10,4),
  layup_width DECIMAL(10,4),
  layup_length DECIMAL(10,4),
  pieces_per_layup INTEGER,
  item_class VARCHAR(20),
  qb_item_code VARCHAR(100),
  price DECIMAL(10,4),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnr_parts_customer ON rnr_parts(customer_id);
CREATE INDEX IF NOT EXISTS idx_rnr_parts_species ON rnr_parts(species_id);
CREATE INDEX IF NOT EXISTS idx_rnr_parts_product_type ON rnr_parts(product_type_id);
CREATE INDEX IF NOT EXISTS idx_rnr_parts_rnr_number ON rnr_parts(rnr_part_number);
CREATE INDEX IF NOT EXISTS idx_rnr_parts_customer_number ON rnr_parts(customer_part_number);

-- ==========================================
-- MACHINES & ROUTINGS
-- ==========================================

CREATE TABLE IF NOT EXISTS rnr_machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  machine_type VARCHAR(50) NOT NULL,
  default_bf_per_hour DECIMAL(10,2),
  default_lf_per_hour DECIMAL(10,2),
  default_pieces_per_hour DECIMAL(10,2),
  labor_cost_per_hour DECIMAL(10,2),
  overhead_cost_per_hour DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS rnr_machine_routings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  product_type_id INTEGER REFERENCES rnr_product_types(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS rnr_machine_routing_steps (
  id SERIAL PRIMARY KEY,
  routing_id INTEGER REFERENCES rnr_machine_routings(id) ON DELETE CASCADE,
  machine_id INTEGER REFERENCES rnr_machines(id),
  step_order INTEGER NOT NULL,
  override_bf_per_hour DECIMAL(10,2),
  override_lf_per_hour DECIMAL(10,2),
  notes TEXT
);

-- ==========================================
-- LUMBER PRICING
-- ==========================================

CREATE TABLE IF NOT EXISTS rnr_lumber_pricing (
  id SERIAL PRIMARY KEY,
  species_id INTEGER REFERENCES rnr_species(id),
  grade VARCHAR(50),
  thickness DECIMAL(10,4),
  cost_per_bf DECIMAL(10,4),
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rnr_customer_pricing (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  part_id INTEGER REFERENCES rnr_parts(id),
  price_per_bf DECIMAL(10,4),
  price_per_lf DECIMAL(10,4),
  price_per_piece DECIMAL(10,4),
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- ORDERS
-- ==========================================

CREATE TABLE IF NOT EXISTS rnr_orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  po_number VARCHAR(100),
  order_number VARCHAR(50),
  order_date DATE NOT NULL,
  due_date DATE,
  ship_to_address TEXT,
  status VARCHAR(20) DEFAULT 'ordered',
  is_rush BOOLEAN DEFAULT false,
  notes TEXT,
  total_price DECIMAL(12,2),
  source VARCHAR(20),
  quote_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnr_orders_customer ON rnr_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_rnr_orders_due_date ON rnr_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_rnr_orders_status ON rnr_orders(status);

CREATE TABLE IF NOT EXISTS rnr_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES rnr_orders(id) ON DELETE CASCADE,
  part_id INTEGER REFERENCES rnr_parts(id),
  customer_part_number VARCHAR(100),
  description TEXT,
  quantity_ordered INTEGER NOT NULL,
  quantity_final INTEGER,
  price_per_unit DECIMAL(10,4),
  price_unit VARCHAR(10),
  line_total DECIMAL(12,2),
  is_new_part BOOLEAN DEFAULT false,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_rnr_order_items_order ON rnr_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_rnr_order_items_part ON rnr_order_items(part_id);

-- ==========================================
-- QUOTES
-- ==========================================

CREATE TABLE IF NOT EXISTS rnr_quotes (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  quote_number VARCHAR(50),
  quote_date DATE NOT NULL,
  valid_until DATE,
  status VARCHAR(20) DEFAULT 'draft',
  notes TEXT,
  total_cost DECIMAL(12,2),
  total_price DECIMAL(12,2),
  margin_pct DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rnr_quote_items (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER REFERENCES rnr_quotes(id) ON DELETE CASCADE,
  part_id INTEGER REFERENCES rnr_parts(id),
  description TEXT,
  species_id INTEGER REFERENCES rnr_species(id),
  product_type_id INTEGER REFERENCES rnr_product_types(id),
  profile_id INTEGER REFERENCES rnr_profiles(id),
  thickness DECIMAL(10,6),
  width DECIMAL(10,4),
  length DECIMAL(10,4),
  board_feet DECIMAL(10,4),
  lineal_feet DECIMAL(10,4),
  quantity INTEGER NOT NULL,
  material_cost_per_unit DECIMAL(10,4),
  labor_cost_per_unit DECIMAL(10,4),
  machine_cost_per_unit DECIMAL(10,4),
  total_cost_per_unit DECIMAL(10,4),
  markup_pct DECIMAL(5,2),
  price_per_unit DECIMAL(10,4),
  price_unit VARCHAR(10),
  line_total DECIMAL(12,2),
  line_cost DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS rnr_quote_item_machines (
  id SERIAL PRIMARY KEY,
  quote_item_id INTEGER REFERENCES rnr_quote_items(id) ON DELETE CASCADE,
  machine_id INTEGER REFERENCES rnr_machines(id),
  step_order INTEGER,
  bf_per_hour DECIMAL(10,2),
  lf_per_hour DECIMAL(10,2),
  estimated_hours DECIMAL(10,4),
  cost_per_hour DECIMAL(10,2),
  step_cost DECIMAL(10,4)
);
