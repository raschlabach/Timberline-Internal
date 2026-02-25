-- Part Builder Reference Pricing
-- Customers and species are shared across all tabs
-- Parts are scoped to a specific tab (rp, df, sq, sq125, stiles, copes, s4s)

CREATE TABLE IF NOT EXISTS part_builder_customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS part_builder_species (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS part_builder_parts (
  id SERIAL PRIMARY KEY,
  tab_id VARCHAR(20) NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES part_builder_customers(id) ON DELETE CASCADE,
  species_id INTEGER NOT NULL REFERENCES part_builder_species(id) ON DELETE CASCADE,
  part_name VARCHAR(200) NOT NULL,
  price_per_bf DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_part_builder_parts_tab ON part_builder_parts(tab_id);
CREATE INDEX IF NOT EXISTS idx_part_builder_parts_customer ON part_builder_parts(customer_id);
CREATE INDEX IF NOT EXISTS idx_part_builder_parts_species ON part_builder_parts(species_id);
