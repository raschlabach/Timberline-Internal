-- Lumber Reference Data Tables
-- Add tables for species and grades so users can select instead of typing

-- Species reference table
CREATE TABLE IF NOT EXISTS lumber_species (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lumber_species_active ON lumber_species(is_active);
CREATE INDEX idx_lumber_species_order ON lumber_species(display_order, name);

-- Grades reference table
CREATE TABLE IF NOT EXISTS lumber_grades (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lumber_grades_active ON lumber_grades(is_active);
CREATE INDEX idx_lumber_grades_order ON lumber_grades(display_order, name);

-- Add triggers for updated_at
CREATE TRIGGER update_lumber_species_updated_at BEFORE UPDATE ON lumber_species
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

CREATE TRIGGER update_lumber_grades_updated_at BEFORE UPDATE ON lumber_grades
    FOR EACH ROW EXECUTE FUNCTION update_lumber_updated_at_column();

-- Insert common species
INSERT INTO lumber_species (name, display_order) VALUES
('Ash', 10),
('Alder', 20),
('Br Hard Maple', 30),
('Cherry', 40),
('H Maple', 50),
('Poplar', 60),
('R Oak', 70),
('Sap Cherry', 80),
('Sap Soft Maple', 90),
('Walnut', 100)
ON CONFLICT (name) DO NOTHING;

-- Insert common grades
INSERT INTO lumber_grades (name, display_order) VALUES
('Fas/Uppers', 10),
('1 com', 20),
('2 com', 30),
('2 Shop', 40),
('SEL Strips', 50),
('Cab', 60)
ON CONFLICT (name) DO NOTHING;
