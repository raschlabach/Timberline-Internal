-- Migration to add a payroll-page-only display order on
-- truckload_order_assignments.
--
-- The payroll page lets users reorder orders within a truckload for
-- presentation/printing purposes only. Reordering on the payroll page
-- must NOT change the dispatch sequence (sequence_number), which is used
-- by the truckload route/planner.
--
-- payroll_sequence is nullable; when null the row sorts using
-- sequence_number. When the user manually reorders the payroll list,
-- we set payroll_sequence on each assignment for that truckload.

ALTER TABLE truckload_order_assignments
  ADD COLUMN IF NOT EXISTS payroll_sequence INTEGER;

CREATE INDEX IF NOT EXISTS idx_assignments_payroll_sequence
  ON truckload_order_assignments(truckload_id, payroll_sequence);
