-- Migration script to transfer existing freight data to the new freight_items table

-- Start transaction for safety
BEGIN;

-- Check if old columns exist in orders table
DO $$
DECLARE
  skids_exists BOOLEAN;
  vinyl_exists BOOLEAN;
  footage_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'skids'
  ) INTO skids_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'vinyl'
  ) INTO vinyl_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'footage'
  ) INTO footage_exists;
  
  -- Only do migration if the columns exist
  IF skids_exists THEN
    -- Migrate skids data to freight_items
    INSERT INTO freight_items (order_id, type, quantity)
    SELECT id, 'skid', COALESCE(skids, 0)
    FROM orders
    WHERE COALESCE(skids, 0) > 0;
    
    RAISE NOTICE 'Migrated skids data';
  END IF;
  
  IF vinyl_exists THEN
    -- Migrate vinyl data to freight_items
    INSERT INTO freight_items (order_id, type, quantity)
    SELECT id, 'vinyl', COALESCE(vinyl, 0)
    FROM orders
    WHERE COALESCE(vinyl, 0) > 0;
    
    RAISE NOTICE 'Migrated vinyl data';
  END IF;
  
  IF footage_exists THEN
    -- Migrate footage data to freight_items
    INSERT INTO freight_items (order_id, type, quantity)
    SELECT id, 'footage', COALESCE(footage, 0)
    FROM orders
    WHERE COALESCE(footage, 0) > 0;
    
    RAISE NOTICE 'Migrated footage data';
  END IF;
END $$;

-- Commit the transaction
COMMIT; 