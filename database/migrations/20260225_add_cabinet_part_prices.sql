-- Cabinet Shop Part Prices
-- Stores per-unit prices for NB parts so we can compare against their pricing

CREATE TABLE IF NOT EXISTS cabinet_part_prices (
  id SERIAL PRIMARY KEY,
  part_number VARCHAR(50) NOT NULL,
  our_price DECIMAL(10, 4) NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT cabinet_part_prices_part_number_unique UNIQUE (part_number)
);

CREATE INDEX IF NOT EXISTS idx_cabinet_part_prices_part_number ON cabinet_part_prices(part_number);
