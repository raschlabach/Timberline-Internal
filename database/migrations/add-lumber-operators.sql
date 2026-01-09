-- Add lumber operators/stackers table
CREATE TABLE IF NOT EXISTS lumber_operators (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint on name
CREATE UNIQUE INDEX IF NOT EXISTS lumber_operators_name_unique ON lumber_operators(name);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_lumber_operators_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lumber_operators_updated_at ON lumber_operators;
CREATE TRIGGER lumber_operators_updated_at
  BEFORE UPDATE ON lumber_operators
  FOR EACH ROW
  EXECUTE FUNCTION update_lumber_operators_updated_at();
