-- Migration: Add Misc Rip System
-- This creates tables for tracking miscellaneous ripping jobs for outside customers
-- These do NOT affect inventory levels but DO count toward rip totals and bonuses

-- Table for misc rip orders (customer jobs)
CREATE TABLE IF NOT EXISTS misc_rip_orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    species VARCHAR(100) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    thickness VARCHAR(20) DEFAULT '4/4',
    estimated_footage INTEGER,
    notes TEXT,
    is_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for misc rip packs (individual packs ripped for misc orders)
CREATE TABLE IF NOT EXISTS misc_rip_packs (
    id SERIAL PRIMARY KEY,
    misc_order_id INTEGER NOT NULL REFERENCES misc_rip_orders(id) ON DELETE CASCADE,
    pack_id VARCHAR(50),
    actual_board_feet INTEGER,
    rip_yield DECIMAL(5,2),
    operator_id INTEGER REFERENCES lumber_operators(id),
    stacker_1_id INTEGER REFERENCES lumber_operators(id),
    stacker_2_id INTEGER REFERENCES lumber_operators(id),
    stacker_3_id INTEGER REFERENCES lumber_operators(id),
    stacker_4_id INTEGER REFERENCES lumber_operators(id),
    rip_comments TEXT,
    is_finished BOOLEAN DEFAULT FALSE,
    finished_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_misc_rip_orders_customer ON misc_rip_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_misc_rip_orders_complete ON misc_rip_orders(is_complete);
CREATE INDEX IF NOT EXISTS idx_misc_rip_packs_order_id ON misc_rip_packs(misc_order_id);
CREATE INDEX IF NOT EXISTS idx_misc_rip_packs_finished ON misc_rip_packs(is_finished);
CREATE INDEX IF NOT EXISTS idx_misc_rip_packs_finished_at ON misc_rip_packs(finished_at);
