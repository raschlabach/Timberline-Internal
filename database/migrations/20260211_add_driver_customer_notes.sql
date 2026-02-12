-- Migration: Add driver_customer_notes table
-- Allows drivers to leave notes on customers from the driver portal

CREATE TABLE IF NOT EXISTS driver_customer_notes (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookup by customer
CREATE INDEX IF NOT EXISTS idx_driver_customer_notes_customer_id ON driver_customer_notes(customer_id);

-- Index for quick lookup by driver
CREATE INDEX IF NOT EXISTS idx_driver_customer_notes_driver_id ON driver_customer_notes(driver_id);

-- Composite index for driver + customer lookups
CREATE INDEX IF NOT EXISTS idx_driver_customer_notes_driver_customer ON driver_customer_notes(driver_id, customer_id);
