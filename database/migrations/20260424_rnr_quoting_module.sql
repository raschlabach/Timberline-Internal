-- RNR Quoting Module Migration
-- Drops old placeholder quote/machine tables and creates new schema
-- Run via /api/admin/apply-rnr-quoting-migration

-- ==========================================
-- DROP OLD PLACEHOLDER TABLES (dependency order)
-- ==========================================

DROP TABLE IF EXISTS rnr_quote_item_machines CASCADE;
DROP TABLE IF EXISTS rnr_quote_items CASCADE;
DROP TABLE IF EXISTS rnr_quotes CASCADE;
DROP TABLE IF EXISTS rnr_machine_routing_steps CASCADE;
DROP TABLE IF EXISTS rnr_machine_routings CASCADE;
DROP TABLE IF EXISTS rnr_machines CASCADE;

-- ==========================================
-- ENUM TYPES
-- ==========================================

DO $$ BEGIN
  CREATE TYPE throughput_unit_enum AS ENUM ('LF_HR', 'BF_HR', 'PIECES_HR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quote_status_enum AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_type_enum AS ENUM ('LF', 'BF', 'PIECES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- 1. rnr_machines
-- ==========================================

CREATE TABLE rnr_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate_per_hour DECIMAL(10,2) NOT NULL,
  setup_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  throughput_unit throughput_unit_enum NOT NULL,
  throughput_rate DECIMAL(10,2) NOT NULL,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 2. rnr_product_templates
-- ==========================================

CREATE TABLE rnr_product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 3. rnr_product_machine_steps
-- ==========================================

CREATE TABLE rnr_product_machine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_template_id UUID NOT NULL REFERENCES rnr_product_templates(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES rnr_machines(id),
  step_order INTEGER NOT NULL,
  throughput_override DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rnr_product_machine_steps_template ON rnr_product_machine_steps(product_template_id);
CREATE INDEX idx_rnr_product_machine_steps_machine ON rnr_product_machine_steps(machine_id);

-- ==========================================
-- 4. rnr_yield_defaults
-- ==========================================

CREATE TABLE rnr_yield_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species TEXT NOT NULL,
  grade TEXT NOT NULL,
  yield_percent DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(species, grade)
);

-- ==========================================
-- 5. rnr_quote_defaults (single-row table)
-- ==========================================

CREATE TABLE rnr_quote_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  margin_1 DECIMAL(5,2) DEFAULT 20,
  margin_2 DECIMAL(5,2) DEFAULT 25,
  margin_3 DECIMAL(5,2) DEFAULT 30,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO rnr_quote_defaults (margin_1, margin_2, margin_3)
VALUES (20, 25, 30)
ON CONFLICT DO NOTHING;

-- ==========================================
-- 6. rnr_quotes
-- ==========================================

CREATE TABLE rnr_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL,
  status quote_status_enum NOT NULL DEFAULT 'DRAFT',
  customer_name TEXT NOT NULL,
  job_reference TEXT,
  product_template_id UUID REFERENCES rnr_product_templates(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  species TEXT NOT NULL,
  grade TEXT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  unit_type unit_type_enum NOT NULL,
  width_inches DECIMAL(10,4),
  thickness_inches DECIMAL(10,4),
  length_inches DECIMAL(10,4),
  yield_percent_used DECIMAL(5,2) NOT NULL,
  lumber_cost_per_bf DECIMAL(10,4) NOT NULL,
  rough_bf_required DECIMAL(12,4) NOT NULL,
  lumber_cost_total DECIMAL(12,2) NOT NULL,
  tooling_surcharges JSONB DEFAULT '[]',
  total_cost DECIMAL(12,2) NOT NULL,
  margin_percent_applied DECIMAL(5,2) NOT NULL,
  final_price DECIMAL(12,2) NOT NULL,
  margin_1_snapshot DECIMAL(5,2),
  margin_2_snapshot DECIMAL(5,2),
  margin_3_snapshot DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rnr_quotes_status ON rnr_quotes(status);
CREATE INDEX idx_rnr_quotes_customer ON rnr_quotes(customer_name);
CREATE INDEX idx_rnr_quotes_number ON rnr_quotes(quote_number);

-- ==========================================
-- 7. rnr_quote_machine_steps
-- ==========================================

CREATE TABLE rnr_quote_machine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES rnr_quotes(id) ON DELETE CASCADE,
  machine_name_snapshot TEXT NOT NULL,
  rate_per_hour_snapshot DECIMAL(10,2) NOT NULL,
  setup_cost_snapshot DECIMAL(10,2) NOT NULL,
  throughput_unit_snapshot TEXT NOT NULL,
  throughput_rate_snapshot DECIMAL(10,2) NOT NULL,
  time_required_hours DECIMAL(10,4) NOT NULL,
  machine_cost_total DECIMAL(12,2) NOT NULL,
  step_order INTEGER NOT NULL
);

CREATE INDEX idx_rnr_quote_machine_steps_quote ON rnr_quote_machine_steps(quote_id);
