-- Migration: Add table for saving user price trend selections
-- This allows users to save their selected species/grade combos for the price chart

CREATE TABLE IF NOT EXISTS user_price_trend_selections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species VARCHAR(100) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint to prevent duplicate selections per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_price_trend_unique
ON user_price_trend_selections(user_id, species, grade);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_user_price_trend_user
ON user_price_trend_selections(user_id);
