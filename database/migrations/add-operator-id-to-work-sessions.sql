-- Add operator_id column to lumber_work_sessions to link with lumber_operators
-- This allows operators to log hours without needing a user account

-- Add the new column
ALTER TABLE lumber_work_sessions 
ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES lumber_operators(id);

-- Make user_id nullable (operators may not have user accounts)
ALTER TABLE lumber_work_sessions 
ALTER COLUMN user_id DROP NOT NULL;

-- Create index for operator lookup
CREATE INDEX IF NOT EXISTS idx_lumber_work_sessions_operator ON lumber_work_sessions(operator_id);

-- Drop the old unique constraint and create a new one with operator_id
DROP INDEX IF EXISTS idx_lumber_work_sessions_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lumber_work_sessions_unique 
ON lumber_work_sessions(COALESCE(operator_id, user_id), work_date);
