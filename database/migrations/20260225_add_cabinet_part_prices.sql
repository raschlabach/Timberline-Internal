-- Cabinet Shop Category Prices
-- Stores $/BF rate per profile + species combination
-- e.g. ISP01 + Red Oak = $1.20/BF, Slant Shaker + Soft Maple = $1.05/BF

DROP TABLE IF EXISTS cabinet_part_prices;

CREATE TABLE IF NOT EXISTS cabinet_category_prices (
  id SERIAL PRIMARY KEY,
  profile VARCHAR(100) NOT NULL,
  species VARCHAR(100) NOT NULL,
  price_per_bf DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT cabinet_category_prices_profile_species_unique UNIQUE (profile, species)
);

CREATE INDEX IF NOT EXISTS idx_cabinet_category_prices_profile ON cabinet_category_prices(profile);
CREATE INDEX IF NOT EXISTS idx_cabinet_category_prices_species ON cabinet_category_prices(species);
