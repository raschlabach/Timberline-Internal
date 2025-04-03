-- Make trailer_number column nullable in truckloads table
ALTER TABLE truckloads
ALTER COLUMN trailer_number DROP NOT NULL; 