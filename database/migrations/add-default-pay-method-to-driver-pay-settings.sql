-- Migration to add a per-driver default pay calculation method.
-- When a new truckload is created for the driver, this method is used as
-- the initial pay_calculation_method on that truckload. The method can
-- still be overridden per-load on the payroll page.

ALTER TABLE driver_pay_settings
  ADD COLUMN IF NOT EXISTS default_pay_method VARCHAR(20) DEFAULT 'automatic' NOT NULL;

-- Constrain to the same set of values used on the truckloads table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_schema = 'public'
          AND table_name = 'driver_pay_settings'
          AND constraint_name = 'driver_pay_settings_default_pay_method_check'
    ) THEN
        ALTER TABLE driver_pay_settings
          ADD CONSTRAINT driver_pay_settings_default_pay_method_check
          CHECK (default_pay_method IN ('automatic', 'hourly', 'manual'));
    END IF;
END$$;
