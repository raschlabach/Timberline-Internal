-- Migration to add flexible pricing notes system
-- This system allows for organized pricing information without affecting existing functionality

-- Create pricing categories for organizing different types of pricing information
CREATE TABLE IF NOT EXISTS pricing_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- For UI color coding
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on category name for faster lookups
CREATE INDEX IF NOT EXISTS idx_pricing_categories_name ON pricing_categories(name);

-- Main pricing notes table with flexible structure
CREATE TABLE IF NOT EXISTS pricing_notes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category_id INTEGER REFERENCES pricing_categories(id),
    content TEXT NOT NULL,
    tags TEXT[], -- Array of tags for flexible searching
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pricing_notes_category ON pricing_notes(category_id);
CREATE INDEX IF NOT EXISTS idx_pricing_notes_active ON pricing_notes(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_notes_created_by ON pricing_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_pricing_notes_tags ON pricing_notes USING GIN(tags);

-- Pricing templates for common scenarios
CREATE TABLE IF NOT EXISTS pricing_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL, -- Flexible JSON structure for different pricing scenarios
    category_id INTEGER REFERENCES pricing_categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for templates
CREATE INDEX IF NOT EXISTS idx_pricing_templates_category ON pricing_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_pricing_templates_active ON pricing_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_templates_created_by ON pricing_templates(created_by);

-- Junction table to link pricing notes to customers (many-to-many relationship)
CREATE TABLE IF NOT EXISTS pricing_note_customers (
    id SERIAL PRIMARY KEY,
    pricing_note_id INTEGER NOT NULL REFERENCES pricing_notes(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pricing_note_id, customer_id)
);

-- Create indexes for the junction table
CREATE INDEX IF NOT EXISTS idx_pricing_note_customers_note ON pricing_note_customers(pricing_note_id);
CREATE INDEX IF NOT EXISTS idx_pricing_note_customers_customer ON pricing_note_customers(customer_id);

-- Junction table to link pricing templates to customers
CREATE TABLE IF NOT EXISTS pricing_template_customers (
    id SERIAL PRIMARY KEY,
    pricing_template_id INTEGER NOT NULL REFERENCES pricing_templates(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pricing_template_id, customer_id)
);

-- Create indexes for the template-customer junction table
CREATE INDEX IF NOT EXISTS idx_pricing_template_customers_template ON pricing_template_customers(pricing_template_id);
CREATE INDEX IF NOT EXISTS idx_pricing_template_customers_customer ON pricing_template_customers(customer_id);

-- Insert default pricing categories
INSERT INTO pricing_categories (name, description, color, sort_order) VALUES
('Freight Types', 'Pricing notes for different types of freight (skids, vinyl, hand bundles)', '#EF4444', 1),
('Distance-Based', 'Pricing based on delivery distance and routes', '#F59E0B', 2),
('Customer-Specific', 'Special pricing arrangements for specific customers', '#10B981', 3),
('Seasonal', 'Pricing adjustments for different seasons or time periods', '#8B5CF6', 4),
('Rush Orders', 'Pricing for rush and expedited deliveries', '#EC4899', 5),
('Special Services', 'Pricing for additional services and special requirements', '#06B6D4', 6),
('General Guidelines', 'General pricing guidelines and best practices', '#6B7280', 7)
ON CONFLICT DO NOTHING;

-- Create update timestamp trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_pricing_categories_timestamp 
    BEFORE UPDATE ON pricing_categories 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_pricing_notes_timestamp 
    BEFORE UPDATE ON pricing_notes 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_pricing_templates_timestamp 
    BEFORE UPDATE ON pricing_templates 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Add some sample pricing notes to get started
INSERT INTO pricing_notes (title, category_id, content, tags, created_by) 
SELECT 
    'Standard Skid Pricing',
    pc.id,
    'Base rate: $X per skid for standard deliveries within 50 miles. Add $Y for each additional 25 miles.',
    ARRAY['skids', 'standard', 'base-rate'],
    1
FROM pricing_categories pc WHERE pc.name = 'Freight Types'
ON CONFLICT DO NOTHING;

INSERT INTO pricing_notes (title, category_id, content, tags, created_by) 
SELECT 
    'Rush Order Premium',
    pc.id,
    'Rush orders add 25% premium to base rate. Same-day delivery adds additional 50% premium.',
    ARRAY['rush', 'premium', 'same-day'],
    1
FROM pricing_categories pc WHERE pc.name = 'Rush Orders'
ON CONFLICT DO NOTHING;

INSERT INTO pricing_notes (title, category_id, content, tags, created_by) 
SELECT 
    'Ohio to Indiana Route',
    pc.id,
    'Standard OH to IN route: $Z base rate. Consider fuel surcharge for longer distances.',
    ARRAY['ohio', 'indiana', 'route', 'fuel-surcharge'],
    1
FROM pricing_categories pc WHERE pc.name = 'Distance-Based'
ON CONFLICT DO NOTHING;
