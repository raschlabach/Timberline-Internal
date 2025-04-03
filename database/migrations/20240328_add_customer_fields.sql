-- Add customer fields to trailer_layout_items table
ALTER TABLE trailer_layout_items
ADD COLUMN customer_id INTEGER,
ADD COLUMN customer_name VARCHAR(255);

-- Create index on customer_id for faster customer-based queries
CREATE INDEX idx_trailer_layout_items_customer_id ON trailer_layout_items(customer_id); 