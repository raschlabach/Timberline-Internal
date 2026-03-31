-- Print tracking for truckload sheets
-- Records when each sheet type was last printed so dispatchers can see
-- which papers are current vs stale on the truckload manager page.

ALTER TABLE truckloads
  ADD COLUMN IF NOT EXISTS truckload_sheet_printed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pickup_list_printed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS loading_sheet_printed_at TIMESTAMP;
