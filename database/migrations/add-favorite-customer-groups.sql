-- Add table to store favorite customer groups (parent groups) per user
CREATE TABLE IF NOT EXISTS favorite_customer_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, customer_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_favorite_customer_groups_user ON favorite_customer_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_customer_groups_customer ON favorite_customer_groups(customer_name);

