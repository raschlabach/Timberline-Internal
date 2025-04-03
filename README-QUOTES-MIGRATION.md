# Quotes Migration Guide

This guide outlines how to properly migrate the customer quotes system from the current text-based quotes field to the new structured quotes table.

## Background

Previously, customer quotes were stored as a simple text field in the `customers` table. The new implementation uses a dedicated `quotes` table with proper fields for date, description, and price, allowing for multiple quotes per customer with much better organization.

## Migration Steps

1. Open the Neon.tech dashboard and navigate to your project.
2. Select the appropriate branch (preview for testing, main for production).
3. Open the SQL editor.
4. Copy and paste the SQL migration script below into the editor and run it:

```sql
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
```

5. Verify that the migration completed successfully by running:

```sql
SELECT * FROM quotes;
```

## New Features

After the migration is complete, you'll be able to:

1. Create multiple quotes per customer with full details
2. View a quote history for each customer
3. Edit or delete individual quotes
4. Track quote dates and prices properly

## API Endpoints

The following new API endpoints are available:

- `GET /api/customers/[id]/quotes` - Get all quotes for a customer
- `POST /api/customers/[id]/quotes` - Create a new quote
- `GET /api/customers/[id]/quotes/[quoteId]` - Get a specific quote
- `PUT /api/customers/[id]/quotes/[quoteId]` - Update a specific quote
- `DELETE /api/customers/[id]/quotes/[quoteId]` - Delete a specific quote 