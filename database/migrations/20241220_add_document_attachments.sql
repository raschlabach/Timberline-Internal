-- Create document_attachments table
CREATE TABLE IF NOT EXISTS document_attachments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL DEFAULT 'document_attachment',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    document_attachment_id INTEGER REFERENCES document_attachments(id) ON DELETE CASCADE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_by INTEGER REFERENCES users(id),
    dismissed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_attachments_order_id ON document_attachments(order_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_uploaded_by ON document_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_dismissed ON notifications(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications(order_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_attachments_updated_at 
    BEFORE UPDATE ON document_attachments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
