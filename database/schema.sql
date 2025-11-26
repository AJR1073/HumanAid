-- HumanAid Database Schema
-- PostgreSQL with PostGIS extension for geospatial queries

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For full-text search

-- ==================== CORE TABLES ====================

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    icon VARCHAR(100),
    color VARCHAR(7),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('need_help', 'want_help', 'both')),
    parent_id INTEGER REFERENCES categories(id),
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resources table (main table for all assistance locations)
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT,
    
    -- Location data
    address VARCHAR(500),
    city VARCHAR(200) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10),
    county VARCHAR(200),
    location GEOGRAPHY(POINT, 4326), -- PostGIS geospatial point
    
    -- Contact info
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(500),
    
    -- Hours & availability
    hours_of_operation JSONB, -- Flexible JSON for complex schedules
    service_area TEXT,
    languages_spoken TEXT[],
    
    -- Eligibility & requirements
    eligibility_requirements TEXT,
    required_documents TEXT[],
    appointment_required BOOLEAN DEFAULT false,
    walk_ins_accepted BOOLEAN DEFAULT true,
    
    -- Metadata
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    verified_by INTEGER,
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'flagged')),
    quality_score INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    contact_count INTEGER DEFAULT 0,
    
    -- Submission tracking
    submitted_by INTEGER,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER,
    approved_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resource categories junction table (many-to-many)
CREATE TABLE resource_categories (
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, category_id)
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    user_type VARCHAR(20) CHECK (user_type IN ('individual', 'nonprofit', 'business', 'admin')),
    organization_name VARCHAR(500),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true
);

-- Sponsorships table
CREATE TABLE sponsorships (
    id SERIAL PRIMARY KEY,
    sponsor_id INTEGER REFERENCES users(id),
    resource_id INTEGER REFERENCES resources(id),
    sponsor_type VARCHAR(50) CHECK (sponsor_type IN ('business', 'individual', 'foundation')),
    amount DECIMAL(10, 2),
    frequency VARCHAR(20) CHECK (frequency IN ('one-time', 'monthly', 'annual')),
    start_date DATE,
    end_date DATE,
    visibility_level VARCHAR(20) DEFAULT 'standard',
    logo_url VARCHAR(500),
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donations table
CREATE TABLE donations (
    id SERIAL PRIMARY KEY,
    donor_id INTEGER REFERENCES users(id),
    resource_id INTEGER REFERENCES resources(id),
    amount DECIMAL(10, 2) NOT NULL,
    donation_type VARCHAR(20) CHECK (donation_type IN ('monetary', 'goods', 'services')),
    description TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    donated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volunteer opportunities table
CREATE TABLE volunteer_opportunities (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    location VARCHAR(500),
    is_remote BOOLEAN DEFAULT false,
    date_time TIMESTAMP,
    duration_hours INTEGER,
    spots_available INTEGER,
    spots_filled INTEGER DEFAULT 0,
    requirements TEXT,
    is_urgent BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'filled', 'cancelled', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volunteer signups table
CREATE TABLE volunteer_signups (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER REFERENCES volunteer_opportunities(id),
    volunteer_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    notes TEXT,
    signed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Reviews/flags table
CREATE TABLE resource_reviews (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id),
    user_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    is_flagged BOOLEAN DEFAULT false,
    flag_reason TEXT,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User favorites table
CREATE TABLE user_favorites (
    user_id INTEGER REFERENCES users(id),
    resource_id INTEGER REFERENCES resources(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, resource_id)
);

-- Activity log table
CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(100),
    resource_id INTEGER REFERENCES resources(id),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================

-- Geospatial index for location-based queries
CREATE INDEX idx_resources_location ON resources USING GIST(location);

-- Full-text search indexes
CREATE INDEX idx_resources_name ON resources USING GIN(to_tsvector('english', name));
CREATE INDEX idx_resources_description ON resources USING GIN(to_tsvector('english', description));
CREATE INDEX idx_resources_city ON resources(city);
CREATE INDEX idx_resources_state ON resources(state);
CREATE INDEX idx_resources_zip ON resources(zip_code);

-- Category lookups
CREATE INDEX idx_resource_categories_resource ON resource_categories(resource_id);
CREATE INDEX idx_resource_categories_category ON resource_categories(category_id);

-- Status and filtering
CREATE INDEX idx_resources_approved ON resources(approval_status, is_active);
CREATE INDEX idx_resources_verified ON resources(verified);

-- User lookups
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for resources table
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for categories table
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
BEGIN
    RETURN ST_Distance(
        ST_MakePoint(lon1, lat1)::geography,
        ST_MakePoint(lon2, lat2)::geography
    ) / 1609.34; -- Convert meters to miles
END;
$$ LANGUAGE plpgsql;

-- ==================== COMMENTS ====================

COMMENT ON TABLE resources IS 'Main table for all humanitarian assistance locations and services';
COMMENT ON COLUMN resources.location IS 'PostGIS geography point for geospatial queries';
COMMENT ON COLUMN resources.hours_of_operation IS 'Flexible JSON format for complex schedules';
COMMENT ON TABLE sponsorships IS 'Tracks business and individual sponsorships of resources';
COMMENT ON TABLE volunteer_opportunities IS 'Volunteer opportunities posted by organizations';
