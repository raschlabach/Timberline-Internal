-- Migration to add file_data column to document_attachments for storing uploaded files
BEGIN;

-- Add file_data column to store base64 encoded file content
ALTER TABLE document_attachments 
ADD COLUMN IF NOT EXISTS file_data TEXT;

COMMIT;

