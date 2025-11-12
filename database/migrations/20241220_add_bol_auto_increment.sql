-- Add auto-incrementing BOL number functionality
-- This migration creates a sequence for BOL numbers and adds a function to generate them

-- Create a sequence for BOL numbers starting from 1000
CREATE SEQUENCE IF NOT EXISTS bol_number_sequence START 1000;

-- Create a function to get the next BOL number
CREATE OR REPLACE FUNCTION get_next_bol_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    bol_number VARCHAR(50);
BEGIN
    -- Get the next value from the sequence
    next_number := nextval('bol_number_sequence');
    
    -- Format as BOL-XXXX (e.g., BOL-1000, BOL-1001, etc.)
    bol_number := 'BOL-' || LPAD(next_number::TEXT, 4, '0');
    
    RETURN bol_number;
END;
$$ LANGUAGE plpgsql;

-- Update existing truckloads that don't have BOL numbers
-- This will assign BOL numbers to existing truckloads in chronological order
WITH ordered_truckloads AS (
  SELECT id FROM truckloads 
  WHERE bill_of_lading_number IS NULL
  ORDER BY created_at ASC
)
UPDATE truckloads 
SET bill_of_lading_number = get_next_bol_number()
WHERE id IN (SELECT id FROM ordered_truckloads);

-- Add a comment to the sequence for documentation
COMMENT ON SEQUENCE bol_number_sequence IS 'Auto-incrementing sequence for Bill of Lading numbers, starting from 1000';
