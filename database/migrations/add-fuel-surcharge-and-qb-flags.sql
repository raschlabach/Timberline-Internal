-- Migration to support QuickBooks reconciliation on the payroll page.
--
-- Two changes:
--
-- 1. Per-adjustment flag (excluded_from_qb) on
--    cross_driver_freight_deductions. When TRUE, the adjustment still
--    affects load value and driver pay normally — but it is NOT included
--    in the QuickBooks invoice total shown for verification on the
--    payroll page. Default FALSE (i.e., adjustments DO apply to QB
--    totals by default, mirroring how QuickBooks usually works).
--
-- 2. A small payroll_settings table holding the single global
--    fuel_surcharge_percentage used to compute the QB total. Editable
--    by admin so it can move with fuel prices.

ALTER TABLE cross_driver_freight_deductions
  ADD COLUMN IF NOT EXISTS excluded_from_qb BOOLEAN DEFAULT FALSE NOT NULL;

CREATE TABLE IF NOT EXISTS payroll_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  fuel_surcharge_percentage DECIMAL(5, 2) DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payroll_settings_single_row CHECK (id = 1)
);

INSERT INTO payroll_settings (id, fuel_surcharge_percentage)
VALUES (1, 4.00)
ON CONFLICT (id) DO NOTHING;
