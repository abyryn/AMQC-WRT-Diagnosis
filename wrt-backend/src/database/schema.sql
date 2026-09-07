-- ============================================
-- WRT Garage — PostgreSQL Database Schema
-- Version: 2.0 (August 2026)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Users / Technicians
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(50) UNIQUE NOT NULL,
    full_name   VARCHAR(100) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'technician'
                CHECK (role IN ('admin', 'technician', 'viewer')),
    phone       VARCHAR(20),
    email       VARCHAR(100),
    api_key     VARCHAR(64) UNIQUE,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Customers
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20),
    email       VARCHAR(100),
    address     TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Vehicles
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    make            VARCHAR(20) DEFAULT 'Honda',
    model           VARCHAR(50) NOT NULL,
    model_code      VARCHAR(20),
    year            INTEGER,
    vin             VARCHAR(50) UNIQUE,
    plate_number    VARCHAR(20),
    mileage_km      INTEGER DEFAULT 0,
    color           VARCHAR(30),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);

-- ============================================
-- 4. ECU Info (1:1 with Vehicle)
-- ============================================
CREATE TABLE IF NOT EXISTS ecu_info (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
    part_number     VARCHAR(30),
    firmware_version VARCHAR(20),
    manufacturer    VARCHAR(30),
    protocol        VARCHAR(30) DEFAULT 'Honda K-Line (10400bps)',
    init_method     VARCHAR(20) DEFAULT 'Fast Init',
    ecu_type        VARCHAR(30),
    diag_count      INTEGER DEFAULT 0,
    last_diag_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Service Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS service_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    technician_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    mileage_at_svc  INTEGER,
    complaint       TEXT,
    finding         TEXT,
    action_taken    TEXT,
    parts_replaced  JSONB DEFAULT '[]',
    total_cost_idr  INTEGER,
    status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'completed', 'follow_up')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_vehicle ON service_sessions(vehicle_id);
CREATE INDEX idx_sessions_status ON service_sessions(status);

-- ============================================
-- 6. DTC Records (per session)
-- ============================================
CREATE TABLE IF NOT EXISTS dtc_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID REFERENCES service_sessions(id) ON DELETE CASCADE,
    dtc_code        VARCHAR(10) NOT NULL,
    status          VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'pending', 'cleared', 'historical')),
    first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
    cleared_at      TIMESTAMPTZ,
    freeze_frame    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dtc_session ON dtc_records(session_id);
CREATE INDEX idx_dtc_code ON dtc_records(dtc_code);

-- ============================================
-- 7. AI Sessions (per service session)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID REFERENCES service_sessions(id) ON DELETE CASCADE,
    request_json    JSONB NOT NULL,
    response_json   JSONB,
    parsed_summary  TEXT,
    model_used      VARCHAR(60) DEFAULT 'google/gemini-2.5-flash',
    tokens_used     INTEGER,
    latency_ms      INTEGER,
    feedback_score  INTEGER CHECK (feedback_score BETWEEN 1 AND 5),
    feedback_note   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_session ON ai_sessions(session_id);

-- ============================================
-- 8. Live Data Log
-- ============================================
CREATE TABLE IF NOT EXISTS live_data_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID REFERENCES service_sessions(id) ON DELETE CASCADE,
    recorded_at     TIMESTAMPTZ DEFAULT NOW(),
    rpm             INTEGER,
    tps_volt        REAL,
    map_kpa         REAL,
    iat_celsius     REAL,
    ect_celsius     REAL,
    o2_volt         REAL,
    battery_volt    REAL,
    iacv_pct        REAL,
    fuel_trim_pct   REAL,
    vehicle_speed   INTEGER,
    throttle_pos    REAL
);

CREATE INDEX idx_live_session ON live_data_log(session_id);
CREATE INDEX idx_live_time ON live_data_log(recorded_at);

-- ============================================
-- 9. Print History
-- ============================================
CREATE TABLE IF NOT EXISTS print_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    session_id      UUID REFERENCES service_sessions(id) ON DELETE SET NULL,
    printed_at      TIMESTAMPTZ DEFAULT NOW(),
    printer_type    VARCHAR(30),
    paper_width     VARCHAR(10),
    dtc_summary     TEXT,
    receipt_data    JSONB
);

-- ============================================
-- 10. DTC Database (Static Reference)
-- ============================================
CREATE TABLE IF NOT EXISTS dtc_database (
    code            VARCHAR(10) PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    sensor_affected VARCHAR(30),
    circuit         VARCHAR(50),
    normal_range    VARCHAR(50),
    fault_condition TEXT,
    possible_causes JSONB DEFAULT '[]',
    check_steps     JSONB DEFAULT '[]',
    priority        VARCHAR(20) DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    mil_status      VARCHAR(10) DEFAULT 'on',
    related_dtc     JSONB DEFAULT '[]',
    system_group    VARCHAR(30)
);

-- ============================================
-- 11. ECU Reference Database (Static)
-- ============================================
CREATE TABLE IF NOT EXISTS ecu_reference (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model           VARCHAR(50) NOT NULL,
    model_code      VARCHAR(20) NOT NULL,
    year_start      INTEGER,
    year_end        INTEGER,
    part_number     VARCHAR(30) NOT NULL,
    manufacturer    VARCHAR(30) NOT NULL,
    protocol        VARCHAR(40) DEFAULT 'Honda K-Line (10400bps)',
    init_method     VARCHAR(20) DEFAULT 'Fast Init',
    notes           TEXT
);

CREATE INDEX idx_ecu_ref_model ON ecu_reference(model_code);

-- ============================================
-- 12. Firmware Update History
-- ============================================
CREATE TABLE IF NOT EXISTS firmware_updates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id       VARCHAR(50),
    from_version    VARCHAR(20),
    to_version      VARCHAR(20),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    method          VARCHAR(10) CHECK (method IN ('OTA', 'USB')),
    status          VARCHAR(20) DEFAULT 'success'
                    CHECK (status IN ('success', 'failed', 'rollback'))
);

-- ============================================
-- Trigger: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated
    BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehicles_updated
    BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ecu_info_updated
    BEFORE UPDATE ON ecu_info FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_updated
    BEFORE UPDATE ON service_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
