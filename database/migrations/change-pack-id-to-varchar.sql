-- Change pack_id from BIGINT to VARCHAR to allow text, dashes, and spaces
ALTER TABLE lumber_packs ALTER COLUMN pack_id TYPE VARCHAR(50) USING pack_id::VARCHAR;
