-- Migration to add file_data column to order_links for storing uploaded files
BEGIN;

-- Add file_data column to store base64 encoded file content
ALTER TABLE order_links 
ADD COLUMN IF NOT EXISTS file_data TEXT,
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS file_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS file_size INTEGER;

COMMIT;

