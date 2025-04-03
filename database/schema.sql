-- Timberline Logistics Dashboard Database Schema
-- Initially created for Neon.tech preview branch

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users and authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE drivers (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    color VARCHAR(7) NOT NULL,
    phone VARCHAR(20)
);

-- Locations and Customers
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    county VARCHAR(100),
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    is_timberline_warehouse BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_locations_city_state ON locations(city, state);
CREATE INDEX idx_locations_is_warehouse ON locations(is_timberline_warehouse);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    phone_number_1 VARCHAR(20),
    phone_number_2 VARCHAR(20),
    quotes TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_customers_name ON customers(customer_name);
CREATE INDEX idx_customers_location ON customers(location_id);

CREATE TABLE quotes (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quote_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_date ON quotes(quote_date);

-- Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    pickup_customer_id INTEGER NOT NULL REFERENCES customers(id),
    delivery_customer_id INTEGER NOT NULL REFERENCES customers(id),
    paying_customer_id INTEGER REFERENCES customers(id),
    pickup_date DATE NOT NULL,
    freight_quote DECIMAL(10, 2),
    comments TEXT,
    is_rush BOOLEAN DEFAULT FALSE,
    needs_attention BOOLEAN DEFAULT FALSE,
    is_transfer_order BOOLEAN DEFAULT FALSE,
    
    -- Load Type Filters
    oh_to_in BOOLEAN DEFAULT FALSE,
    backhaul BOOLEAN DEFAULT FALSE,
    local_semi BOOLEAN DEFAULT FALSE,
    local_flatbed BOOLEAN DEFAULT FALSE,
    rr_order BOOLEAN DEFAULT FALSE,
    middlefield BOOLEAN DEFAULT FALSE,
    pa_ny BOOLEAN DEFAULT FALSE,
    
    status VARCHAR(50) DEFAULT 'unassigned',
    
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_orders_pickup_customer ON orders(pickup_customer_id);
CREATE INDEX idx_orders_delivery_customer ON orders(delivery_customer_id);
CREATE INDEX idx_orders_pickup_date ON orders(pickup_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_is_rush ON orders(is_rush);

-- Order Links
CREATE TABLE order_links (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_order_links_order ON order_links(order_id);

-- Freight Types
CREATE TABLE skids (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    width INTEGER NOT NULL,
    length INTEGER NOT NULL,
    square_footage INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_skids_order ON skids(order_id);

CREATE TABLE vinyl (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    width INTEGER NOT NULL,
    length INTEGER NOT NULL,
    square_footage INTEGER NOT NULL,
    stack_height INTEGER DEFAULT 1,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_vinyl_order ON vinyl(order_id);

CREATE TABLE footage (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    square_footage INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_footage_order ON footage(order_id);

-- Truckloads
CREATE TABLE truckloads (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER REFERENCES drivers(user_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    trailer_number VARCHAR(50) NOT NULL,
    bill_of_lading_number VARCHAR(50),
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    total_mileage DECIMAL(10, 2),
    estimated_duration INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_truckloads_driver ON truckloads(driver_id);
CREATE INDEX idx_truckloads_dates ON truckloads(start_date, end_date);
CREATE INDEX idx_truckloads_completed ON truckloads(is_completed);

CREATE TABLE truckload_order_assignments (
    id SERIAL PRIMARY KEY,
    truckload_id INTEGER NOT NULL REFERENCES truckloads(id),
    order_id INTEGER NOT NULL REFERENCES orders(id),
    assignment_type VARCHAR(20) NOT NULL,
    sequence_number INTEGER NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_assignments_truckload ON truckload_order_assignments(truckload_id);
CREATE INDEX idx_assignments_order ON truckload_order_assignments(order_id);
CREATE INDEX idx_assignments_type ON truckload_order_assignments(assignment_type);
CREATE INDEX idx_assignments_sequence ON truckload_order_assignments(sequence_number);

CREATE TABLE route_stops (
    id SERIAL PRIMARY KEY,
    truckload_id INTEGER NOT NULL REFERENCES truckloads(id),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    sequence_number INTEGER NOT NULL,
    estimated_arrival_time TIMESTAMP,
    stop_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_route_stops_truckload ON route_stops(truckload_id);
CREATE INDEX idx_route_stops_sequence ON route_stops(sequence_number);

-- Trailer Layout
CREATE TABLE trailer_layouts (
    id SERIAL PRIMARY KEY,
    truckload_id INTEGER NOT NULL REFERENCES truckloads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trailer_layouts_truckload ON trailer_layouts(truckload_id);

CREATE TABLE trailer_layout_items (
    id SERIAL PRIMARY KEY,
    trailer_layout_id INTEGER NOT NULL REFERENCES trailer_layouts(id),
    item_type VARCHAR(20) NOT NULL,
    item_id INTEGER NOT NULL,
    x_position INTEGER NOT NULL,
    y_position INTEGER NOT NULL,
    width INTEGER NOT NULL,
    length INTEGER NOT NULL,
    rotation INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_layout_items_layout ON trailer_layout_items(trailer_layout_id);
CREATE INDEX idx_layout_items_position ON trailer_layout_items(x_position, y_position);

-- Order Presets
CREATE TABLE order_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    pickup_customer_id INTEGER REFERENCES customers(id),
    delivery_customer_id INTEGER REFERENCES customers(id),
    paying_customer_id INTEGER REFERENCES customers(id),
    
    -- Load Type Filters
    oh_to_in BOOLEAN DEFAULT FALSE,
    backhaul BOOLEAN DEFAULT FALSE,
    local_semi BOOLEAN DEFAULT FALSE,
    local_flatbed BOOLEAN DEFAULT FALSE,
    rr_order BOOLEAN DEFAULT FALSE,
    middlefield BOOLEAN DEFAULT FALSE,
    pa_ny BOOLEAN DEFAULT FALSE,
    
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_order_presets_name ON order_presets(name);
CREATE INDEX idx_order_presets_customers ON order_presets(pickup_customer_id, delivery_customer_id);

-- Comments
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    truckload_id INTEGER REFERENCES truckloads(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_comments_order ON comments(order_id);
CREATE INDEX idx_comments_truckload ON comments(truckload_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- Insert Timberline Warehouse (fixed location)
INSERT INTO locations (name, address, city, county, state, zip_code, is_timberline_warehouse)
VALUES ('Timberline Warehouse', '1361 County Road 108', 'Sugar Creek', 'Tuscarawas', 'OH', '44681', TRUE);

-- Add function to automatically update timestamp columns
CREATE OR REPLACE FUNCTION update_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_timestamp trigger to relevant tables
CREATE TRIGGER update_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON order_links FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON skids FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON vinyl FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON footage FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON truckloads FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON truckload_order_assignments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON route_stops FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON trailer_layouts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON trailer_layout_items FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON order_presets FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_timestamp BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Create Views
-- Load Board View
CREATE VIEW load_board_view AS
SELECT 
    o.id, 
    o.status,
    o.pickup_date,
    o.is_rush,
    o.needs_attention,
    o.comments,
    pc.customer_name AS pickup_customer,
    dc.customer_name AS delivery_customer,
    COALESCE(
        (SELECT SUM(square_footage * quantity) FROM skids WHERE order_id = o.id), 0
    ) AS total_skid_footage,
    COALESCE(
        (SELECT SUM(square_footage * quantity) FROM vinyl WHERE order_id = o.id), 0
    ) AS total_vinyl_footage,
    COALESCE(
        (SELECT SUM(square_footage) FROM footage WHERE order_id = o.id), 0
    ) AS total_footage
FROM 
    orders o
JOIN 
    customers pc ON o.pickup_customer_id = pc.id
JOIN 
    customers dc ON o.delivery_customer_id = dc.id
WHERE 
    o.status NOT IN ('completed');

-- Customer History View
CREATE VIEW customer_history_view AS
SELECT
    c.id AS customer_id,
    c.customer_name,
    o.id AS order_id,
    o.pickup_date,
    o.status,
    CASE
        WHEN o.pickup_customer_id = c.id THEN 'pickup'
        WHEN o.delivery_customer_id = c.id THEN 'delivery'
        WHEN o.paying_customer_id = c.id THEN 'paying'
    END AS relationship_type,
    COALESCE(
        (SELECT SUM(square_footage * quantity) FROM skids WHERE order_id = o.id), 0
    ) +
    COALESCE(
        (SELECT SUM(square_footage * quantity) FROM vinyl WHERE order_id = o.id), 0
    ) +
    COALESCE(
        (SELECT SUM(square_footage) FROM footage WHERE order_id = o.id), 0
    ) AS total_footage
FROM
    customers c
JOIN
    orders o ON c.id IN (o.pickup_customer_id, o.delivery_customer_id, o.paying_customer_id)
ORDER BY
    c.customer_name, o.pickup_date DESC;

-- Truckload Summary View
CREATE VIEW truckload_summary_view AS
SELECT
    t.id,
    t.trailer_number,
    t.bill_of_lading_number,
    t.start_date,
    t.end_date,
    u.full_name AS driver_name,
    d.color AS driver_color,
    t.is_completed,
    COUNT(DISTINCT toa.order_id) AS total_orders,
    SUM(CASE WHEN toa.assignment_type = 'pickup' THEN 1 ELSE 0 END) AS pickup_count,
    SUM(CASE WHEN toa.assignment_type = 'delivery' THEN 1 ELSE 0 END) AS delivery_count,
    t.total_mileage,
    t.estimated_duration
FROM
    truckloads t
LEFT JOIN
    drivers d ON t.driver_id = d.user_id
LEFT JOIN
    users u ON d.user_id = u.id
LEFT JOIN
    truckload_order_assignments toa ON t.id = toa.truckload_id
GROUP BY
    t.id, u.full_name, d.color;

-- Schedule Notes Table
CREATE TABLE schedule_notes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB, -- Stores pattern like {"type": "weekly", "days": [1,3,5]} or {"type": "monthly", "day": 15}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    color TEXT DEFAULT '#FFD700' -- Default gold color for notes
);

-- Add trigger for updated_at
CREATE TRIGGER update_timestamp BEFORE UPDATE ON schedule_notes FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Create view for expanded recurring notes
CREATE VIEW expanded_schedule_notes AS
WITH RECURSIVE expanded_dates AS (
    -- Base case: non-recurring notes
    SELECT 
        id,
        title,
        content,
        start_date as note_date,
        color,
        created_by,
        created_at,
        updated_at
    FROM schedule_notes
    WHERE NOT is_recurring
    
    UNION ALL
    
    -- Recursive case: recurring notes
    SELECT 
        n.id,
        n.title,
        n.content,
        CASE 
            WHEN n.recurrence_pattern->>'type' = 'weekly' THEN
                (n.start_date + (generate_series * 7 + (unnest(n.recurrence_pattern->'days'::int[]) - 1)) * interval '1 day')::date
            WHEN n.recurrence_pattern->>'type' = 'monthly' THEN
                (n.start_date + (generate_series * interval '1 month'))::date
            ELSE
                (n.start_date + (generate_series * interval '1 day'))::date
        END as note_date,
        n.color,
        n.created_by,
        n.created_at,
        n.updated_at
    FROM schedule_notes n
    CROSS JOIN generate_series(0, 365) -- Generate dates for up to a year ahead
    WHERE n.is_recurring
    AND CASE 
        WHEN n.recurrence_pattern->>'type' = 'weekly' THEN
            (n.start_date + (generate_series * 7 + (unnest(n.recurrence_pattern->'days'::int[]) - 1)) * interval '1 day')::date <= COALESCE(n.end_date, CURRENT_DATE + interval '1 year')
        WHEN n.recurrence_pattern->>'type' = 'monthly' THEN
            (n.start_date + (generate_series * interval '1 month'))::date <= COALESCE(n.end_date, CURRENT_DATE + interval '1 year')
        ELSE
            (n.start_date + (generate_series * interval '1 day'))::date <= COALESCE(n.end_date, CURRENT_DATE + interval '1 year')
    END
)
SELECT DISTINCT ON (id, note_date) * FROM expanded_dates ORDER BY id, note_date, created_at DESC; 