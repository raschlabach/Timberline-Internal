-- Fix ensure_username_not_null trigger to use full_name instead of name
-- The trigger is checking NEW.name but the users table has full_name column

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS ensure_username_not_null ON users;

-- Drop the function if it exists (we'll recreate it if needed, but since we handle username in app code, we may not need it)
DROP FUNCTION IF EXISTS ensure_username_not_null();

-- If the trigger is still needed, recreate it with the correct column name
-- But since we're now handling username generation in the application code,
-- we'll leave it dropped. If you need it back, uncomment below:
--
-- CREATE OR REPLACE FUNCTION ensure_username_not_null()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.username IS NULL OR TRIM(NEW.username) = '' THEN
--     -- Generate username from full_name if username is missing
--     IF NEW.full_name IS NOT NULL AND LENGTH(TRIM(NEW.full_name)) > 0 THEN
--       NEW.username = LOWER(REGEXP_REPLACE(TRIM(NEW.full_name), '[^a-z0-9]+', '_', 'g'));
--     ELSE
--       RAISE EXCEPTION 'Username is required when full_name is not provided';
--     END IF;
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER ensure_username_not_null
--   BEFORE INSERT OR UPDATE ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION ensure_username_not_null();

