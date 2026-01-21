-- Migration: Add table for dismissed quality warnings
-- This allows users to dismiss low-quality supplier warnings on the create load page

CREATE TABLE IF NOT EXISTS dismissed_quality_warnings (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES lumber_suppliers(id) ON DELETE CASCADE,
    species VARCHAR(100) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    dismissed_by INTEGER REFERENCES users(id),
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint to prevent duplicate dismissals
CREATE UNIQUE INDEX IF NOT EXISTS idx_dismissed_quality_unique 
ON dismissed_quality_warnings(supplier_id, species, grade);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dismissed_quality_supplier 
ON dismissed_quality_warnings(supplier_id);
