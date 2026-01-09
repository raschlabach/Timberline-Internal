-- Add color column to lumber_species table
ALTER TABLE lumber_species 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#6B7280';

-- Set default colors for specific species
UPDATE lumber_species SET color = '#F97316' WHERE name = 'R Oak';           -- Orange
UPDATE lumber_species SET color = '#92400E' WHERE name = 'Walnut';         -- Brown
UPDATE lumber_species SET color = '#3B82F6' WHERE name = 'Poplar';         -- Blue
UPDATE lumber_species SET color = '#A855F7' WHERE name = 'Alder';          -- Purple
UPDATE lumber_species SET color = '#EAB308' WHERE name = 'Ash';            -- Yellow
UPDATE lumber_species SET color = '#EF4444' WHERE name = 'Cherry';         -- Red
UPDATE lumber_species SET color = '#166534' WHERE name = 'Uns Soft Maple'; -- Dark Green
UPDATE lumber_species SET color = '#22C55E' WHERE name = 'Sap Soft Maple'; -- Green
