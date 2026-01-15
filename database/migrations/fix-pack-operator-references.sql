-- Fix lumber_packs to reference lumber_operators instead of users
-- The operator and stacker columns should reference the lumber_operators table

-- First, drop the existing foreign key constraints
ALTER TABLE lumber_packs DROP CONSTRAINT IF EXISTS lumber_packs_operator_id_fkey;
ALTER TABLE lumber_packs DROP CONSTRAINT IF EXISTS lumber_packs_stacker_1_id_fkey;
ALTER TABLE lumber_packs DROP CONSTRAINT IF EXISTS lumber_packs_stacker_2_id_fkey;
ALTER TABLE lumber_packs DROP CONSTRAINT IF EXISTS lumber_packs_stacker_3_id_fkey;
ALTER TABLE lumber_packs DROP CONSTRAINT IF EXISTS lumber_packs_stacker_4_id_fkey;

-- Clear any existing operator/stacker data that might have invalid references
UPDATE lumber_packs SET 
    operator_id = NULL,
    stacker_1_id = NULL,
    stacker_2_id = NULL,
    stacker_3_id = NULL,
    stacker_4_id = NULL
WHERE operator_id IS NOT NULL 
   OR stacker_1_id IS NOT NULL 
   OR stacker_2_id IS NOT NULL 
   OR stacker_3_id IS NOT NULL 
   OR stacker_4_id IS NOT NULL;

-- Add new foreign key constraints referencing lumber_operators
ALTER TABLE lumber_packs 
ADD CONSTRAINT lumber_packs_operator_id_fkey 
FOREIGN KEY (operator_id) REFERENCES lumber_operators(id) ON DELETE SET NULL;

ALTER TABLE lumber_packs 
ADD CONSTRAINT lumber_packs_stacker_1_id_fkey 
FOREIGN KEY (stacker_1_id) REFERENCES lumber_operators(id) ON DELETE SET NULL;

ALTER TABLE lumber_packs 
ADD CONSTRAINT lumber_packs_stacker_2_id_fkey 
FOREIGN KEY (stacker_2_id) REFERENCES lumber_operators(id) ON DELETE SET NULL;

ALTER TABLE lumber_packs 
ADD CONSTRAINT lumber_packs_stacker_3_id_fkey 
FOREIGN KEY (stacker_3_id) REFERENCES lumber_operators(id) ON DELETE SET NULL;

ALTER TABLE lumber_packs 
ADD CONSTRAINT lumber_packs_stacker_4_id_fkey 
FOREIGN KEY (stacker_4_id) REFERENCES lumber_operators(id) ON DELETE SET NULL;
