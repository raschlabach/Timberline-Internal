-- Migration: Add start_time and end_time to truckloads
-- Stores time of day as HH:MM strings (e.g., "08:00", "17:00")
-- Used for visual positioning on the planner calendar

ALTER TABLE truckloads ADD COLUMN IF NOT EXISTS start_time VARCHAR(5);
ALTER TABLE truckloads ADD COLUMN IF NOT EXISTS end_time VARCHAR(5);
