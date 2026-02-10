-- Migration: Add Truckload Planner Support
-- Adds status column to truckloads, creates driver_schedule_events and planner_notes tables

-- 1. Add status column to truckloads table
-- Values: 'draft' (preview/planning), 'active' (real truckload), 'completed' (finished)
ALTER TABLE truckloads ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
  CHECK (status IN ('draft', 'active', 'completed'));

-- Backfill existing rows based on is_completed
UPDATE truckloads SET status = 'completed' WHERE is_completed = true;
UPDATE truckloads SET status = 'active' WHERE is_completed = false OR is_completed IS NULL;

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_truckloads_status ON truckloads(status);

-- 2. Create driver_schedule_events table (vacations, sick days, unavailable)
CREATE TABLE IF NOT EXISTS driver_schedule_events (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(user_id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('vacation', 'sick', 'unavailable', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_schedule_events_driver ON driver_schedule_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_schedule_events_dates ON driver_schedule_events(start_date, end_date);

-- Add trigger for updated_at
CREATE TRIGGER update_driver_schedule_events_timestamp 
  BEFORE UPDATE ON driver_schedule_events 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 3. Create planner_notes table (daily and weekly notes on the calendar)
CREATE TABLE IF NOT EXISTS planner_notes (
  id SERIAL PRIMARY KEY,
  note_type VARCHAR(10) NOT NULL CHECK (note_type IN ('daily', 'weekly')),
  note_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_planner_notes_date ON planner_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_planner_notes_type ON planner_notes(note_type);

-- Add trigger for updated_at
CREATE TRIGGER update_planner_notes_timestamp 
  BEFORE UPDATE ON planner_notes 
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
