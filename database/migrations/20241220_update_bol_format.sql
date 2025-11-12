-- Update BOL number generation to use YYMMXXX format
-- This migration updates the function to generate numbers like 250901, 250902, etc.

-- Drop the old function
DROP FUNCTION IF EXISTS get_next_bol_number();

-- Create a new function to get the next BOL number in YYMMXXX format
CREATE OR REPLACE FUNCTION get_next_bol_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    current_year_month VARCHAR(4);
    next_number INTEGER;
    bol_number VARCHAR(50);
BEGIN
    -- Get current year and month in YYMM format
    current_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
    
    -- Get the next number for this month
    -- Look for existing BOL numbers that start with current YYMM
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(bill_of_lading_number FROM 5) AS INTEGER)) + 1,
        1
    )
    INTO next_number
    FROM truckloads 
    WHERE bill_of_lading_number ~ ('^' || current_year_month || '[0-9]{3}$');
    
    -- Format as YYMMXXX (e.g., 250901, 250902, etc.)
    bol_number := current_year_month || LPAD(next_number::TEXT, 3, '0');
    
    RETURN bol_number;
END;
$$ LANGUAGE plpgsql;

-- Add a comment to the function for documentation
COMMENT ON FUNCTION get_next_bol_number() IS 'Generates BOL numbers in YYMMXXX format (e.g., 250901 for September 2025, first truckload)';
