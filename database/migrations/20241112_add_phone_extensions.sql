-- Add extension fields for customer phone numbers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS phone_number_1_ext VARCHAR(10),
ADD COLUMN IF NOT EXISTS phone_number_2_ext VARCHAR(10);

-- Add comments for clarity
COMMENT ON COLUMN customers.phone_number_1_ext IS 'Extension for primary phone number';
COMMENT ON COLUMN customers.phone_number_2_ext IS 'Extension for secondary phone number';

