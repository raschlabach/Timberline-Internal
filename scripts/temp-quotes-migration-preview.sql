-- Check if quotes table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') THEN
        CREATE TABLE quotes (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER REFERENCES customers(id),
            description TEXT NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            quote_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_quotes_customer ON quotes(customer_id);
        CREATE INDEX idx_quotes_date ON quotes(quote_date);
        
        -- Create update timestamp trigger
        CREATE TRIGGER update_timestamp 
        BEFORE UPDATE ON quotes 
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
        
        RAISE NOTICE 'Created quotes table';
    ELSE
        RAISE NOTICE 'Quotes table already exists';
    END IF;
END
$$;

-- Copy any existing quotes from customers.quotes text field into the quotes table
DO $$
DECLARE
    customer_record RECORD;
    quote_text TEXT;
BEGIN
    FOR customer_record IN SELECT id, quotes FROM customers WHERE quotes IS NOT NULL AND quotes != '' LOOP
        quote_text := customer_record.quotes;
        
        -- Insert a simple quote record for the legacy text
        IF quote_text IS NOT NULL AND quote_text != '' THEN
            INSERT INTO quotes (customer_id, description, price, quote_date)
            VALUES (customer_record.id, quote_text, 0.00, CURRENT_DATE);
            
            RAISE NOTICE 'Migrated quote for customer %', customer_record.id;
        END IF;
    END LOOP;
END
$$; 