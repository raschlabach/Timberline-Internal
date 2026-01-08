-- Add lumber_load_id_ranges table for managing load ID number ranges
CREATE TABLE IF NOT EXISTS lumber_load_id_ranges (
  id SERIAL PRIMARY KEY,
  range_name VARCHAR(100) NOT NULL,
  start_range INTEGER NOT NULL,
  end_range INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_range CHECK (end_range > start_range)
);

-- Insert default range
INSERT INTO lumber_load_id_ranges (range_name, start_range, end_range, is_active)
VALUES ('Default Range', 1000, 9999, TRUE)
ON CONFLICT DO NOTHING;

-- Create index for active ranges
CREATE INDEX IF NOT EXISTS idx_lumber_load_id_ranges_active ON lumber_load_id_ranges(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_lumber_load_id_ranges_updated_at
  BEFORE UPDATE ON lumber_load_id_ranges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get next available load ID
CREATE OR REPLACE FUNCTION get_next_lumber_load_id()
RETURNS INTEGER AS $$
DECLARE
  next_id INTEGER;
  active_range RECORD;
BEGIN
  -- Get the active range
  SELECT * INTO active_range 
  FROM lumber_load_id_ranges 
  WHERE is_active = TRUE 
  ORDER BY id DESC 
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active load ID range configured';
  END IF;
  
  -- Find the lowest available ID in the range
  SELECT COALESCE(
    (SELECT MIN(n) 
     FROM generate_series(active_range.start_range, active_range.end_range) n
     WHERE NOT EXISTS (
       SELECT 1 FROM lumber_loads WHERE load_id = n::TEXT
     )
    ),
    NULL
  ) INTO next_id;
  
  IF next_id IS NULL THEN
    RAISE EXCEPTION 'No available load IDs in range % - %', 
      active_range.start_range, active_range.end_range;
  END IF;
  
  RETURN next_id;
END;
$$ LANGUAGE plpgsql;
