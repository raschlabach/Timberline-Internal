-- Grain Tracking System
-- Separate system for farm grain storage management

-- Yearly starting amounts
CREATE TABLE IF NOT EXISTS grain_yearly_settings (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    starting_amount_lbs DECIMAL(12, 2) NOT NULL DEFAULT 0,
    starting_amount_bushels DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_grain_yearly_settings_year ON grain_yearly_settings(year);

-- Truck tickets (loading/unloading records)
CREATE TABLE IF NOT EXISTS grain_tickets (
    id SERIAL PRIMARY KEY,
    ticket_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ticket_type VARCHAR(10) NOT NULL CHECK (ticket_type IN ('unload', 'load')),
    gross_weight_lbs DECIMAL(12, 2) NOT NULL,
    tare_weight_lbs DECIMAL(12, 2) NOT NULL,
    net_weight_lbs DECIMAL(12, 2) NOT NULL,
    moisture_percent DECIMAL(5, 2),
    moisture_deduction_lbs DECIMAL(12, 2) DEFAULT 0,
    dockage_percent DECIMAL(5, 2),
    dockage_deduction_lbs DECIMAL(12, 2) DEFAULT 0,
    adjusted_net_weight_lbs DECIMAL(12, 2) NOT NULL,
    bushels DECIMAL(12, 2) NOT NULL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_grain_tickets_date ON grain_tickets(ticket_date);
CREATE INDEX IF NOT EXISTS idx_grain_tickets_type ON grain_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_grain_tickets_created_by ON grain_tickets(created_by);

-- Triggers
CREATE TRIGGER update_timestamp_grain_yearly_settings BEFORE UPDATE ON grain_yearly_settings FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp_grain_tickets BEFORE UPDATE ON grain_tickets FOR EACH ROW EXECUTE FUNCTION update_timestamp();
