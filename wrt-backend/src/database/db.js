// ============================================
// WRT Garage — PostgreSQL Connection Pool with Memory Fallback
// ============================================
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let pool = null;
let isPostgresAvailable = false;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://wrt_user:wrt_secret@localhost:5432/wrt_garage',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });

  pool.on('error', (err) => {
    // Only log if we were connected before
    if (isPostgresAvailable) {
      console.warn('[DB] Pool warning:', err.message);
    }
  });
} catch (e) {
  console.warn('[DB] Failed to initialize PostgreSQL pool:', e.message);
}

// In-Memory Database Fallback for local development without PostgreSQL
const memoryStore = {
  customers: [],
  vehicles: [],
  ecu_info: [],
  service_sessions: [],
  dtc_records: [],
  ai_sessions: [],
  live_data_log: [],
  print_history: [],
};

// Seed initial demo data for local mode
function initDemoData() {
  if (memoryStore.vehicles.length === 0) {
    const custId = uuidv4();
    memoryStore.customers.push({
      id: custId,
      name: 'Budi Santoso',
      phone: '0812-3456-7890',
      email: 'budi@example.com',
      address: 'Jl. Merdeka No. 45, Jakarta',
      notes: 'Pelanggan tetap WRT Garage',
      created_at: new Date().toISOString(),
    });

    const vehId = uuidv4();
    memoryStore.vehicles.push({
      id: vehId,
      customer_id: custId,
      make: 'Honda',
      model: 'PCX 160 eSP+',
      model_code: 'K1Z',
      year: 2023,
      vin: 'MH1KF5118PK123456',
      plate_number: 'B 4521 WRT',
      mileage_km: 14250,
      color: 'Matte Black',
      notes: 'Keluhan tarikan awal brebet & lampu MIL berkedip',
      created_at: new Date().toISOString(),
    });

    memoryStore.ecu_info.push({
      id: uuidv4(),
      vehicle_id: vehId,
      part_number: '30400-K1Z-N01',
      firmware_version: 'v2.1.04',
      manufacturer: 'Shindengen',
      protocol: 'Honda K-Line (10400bps)',
      init_method: 'Fast Init',
      diag_count: 3,
      created_at: new Date().toISOString(),
    });

    const sessId = uuidv4();
    memoryStore.service_sessions.push({
      id: sessId,
      vehicle_id: vehId,
      technician_id: null,
      started_at: new Date(Date.now() - 3600000).toISOString(),
      finished_at: null,
      mileage_at_svc: 14250,
      complaint: 'Tarikan gas tersendat di RPM 2000-3000, MIL menyala',
      finding: 'Sensor IAT menunjukkan tegangan tinggi (open circuit, -40°C)',
      action_taken: 'Pembersihan soket sensor IAT dan proteksi seal waterproof',
      parts_replaced: JSON.stringify([{ part: 'Seal Waterproof Soket IAT', qty: 1, price: 15000 }]),
      total_cost_idr: 75000,
      status: 'open',
      created_at: new Date().toISOString(),
    });

    memoryStore.dtc_records.push({
      id: uuidv4(),
      session_id: sessId,
      dtc_code: 'P0113',
      status: 'active',
      first_seen_at: new Date().toISOString(),
      cleared_at: null,
      freeze_frame: JSON.stringify({
        dtc_trigger: 'P0113',
        rpm_at_trigger: 1450,
        ect_at_trigger: 85,
        iat_at_trigger: -40,
        load_at_trigger: 28,
      }),
      created_at: new Date().toISOString(),
    });
  }
}

initDemoData();

/**
 * Run the schema migration from schema.sql
 */
async function migrate() {
  if (!isPostgresAvailable || !pool) {
    console.log('[DB] Running in In-Memory Standalone Mode (No Postgres).');
    return;
  }
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[DB] PostgreSQL Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with optional params or fallback to memoryStore
 */
async function query(text, params = []) {
  if (isPostgresAvailable && pool) {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB-PG] Query executed', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
      }
      return result;
    } catch (err) {
      console.warn('[DB-PG] Query error, falling back to memory store:', err.message);
    }
  }

  // In-Memory Query Handler for development
  const cleanSql = text.replace(/\s+/g, ' ').trim();
  
  // INSERT INTO ai_sessions
  if (cleanSql.startsWith('INSERT INTO ai_sessions')) {
    const newSession = {
      id: uuidv4(),
      session_id: params[0],
      request_json: params[1],
      response_json: params[2],
      parsed_summary: params[3],
      model_used: params[4],
      tokens_used: params[5],
      latency_ms: params[6],
      feedback_score: null,
      feedback_note: null,
      created_at: new Date().toISOString(),
    };
    memoryStore.ai_sessions.push(newSession);
    return { rows: [newSession], rowCount: 1 };
  }

  // UPDATE ai_sessions (Feedback)
  if (cleanSql.startsWith('UPDATE ai_sessions SET feedback_score')) {
    const score = params[0];
    const note = params[1];
    const id = params[2];
    const session = memoryStore.ai_sessions.find((s) => s.id === id);
    if (session) {
      session.feedback_score = score;
      session.feedback_note = note;
      return { rows: [{ id: session.id, feedback_score: session.feedback_score }], rowCount: 1 };
    }
    return { rows: [{ id: id || uuidv4(), feedback_score: score }], rowCount: 1 };
  }

  // INSERT INTO service_sessions
  if (cleanSql.startsWith('INSERT INTO service_sessions')) {
    const newSess = {
      id: uuidv4(),
      vehicle_id: params[0] || memoryStore.vehicles[0]?.id,
      technician_id: params[1] || null,
      mileage_at_svc: params[2] || 0,
      complaint: params[3] || '',
      finding: '',
      action_taken: '',
      parts_replaced: '[]',
      total_cost_idr: 0,
      status: 'open',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    memoryStore.service_sessions.unshift(newSess);
    return { rows: [newSess], rowCount: 1 };
  }

  // SELECT FROM service_sessions list
  if (cleanSql.includes('FROM service_sessions ss') && !cleanSql.includes('WHERE ss.id = $1')) {
    const rows = memoryStore.service_sessions.map((ss) => {
      const veh = memoryStore.vehicles.find((v) => v.id === ss.vehicle_id) || { model: 'PCX 160 eSP+', plate_number: 'B 4521 WRT' };
      return {
        ...ss,
        vehicle_model: veh.model,
        plate_number: veh.plate_number,
        technician_name: 'Mekanik WRT',
      };
    });
    return { rows, rowCount: rows.length };
  }

  // SELECT FROM service_sessions by ID
  if (cleanSql.includes('WHERE ss.id = $1')) {
    const ssId = params[0];
    const ss = memoryStore.service_sessions.find((s) => s.id === ssId) || memoryStore.service_sessions[0];
    if (!ss) return { rows: [], rowCount: 0 };
    const veh = memoryStore.vehicles.find((v) => v.id === ss.vehicle_id) || { model: 'PCX 160 eSP+', year: 2023, plate_number: 'B 4521 WRT' };
    return {
      rows: [{
        ...ss,
        vehicle_model: veh.model,
        vehicle_year: veh.year,
        plate_number: veh.plate_number,
        technician_name: 'Mekanik WRT',
      }],
      rowCount: 1,
    };
  }

  // SELECT FROM dtc_records WHERE session_id = $1
  if (cleanSql.startsWith('SELECT * FROM dtc_records WHERE session_id = $1')) {
    const sessId = params[0];
    const rows = memoryStore.dtc_records.filter((d) => d.session_id === sessId);
    return { rows, rowCount: rows.length };
  }

  // SELECT FROM ai_sessions WHERE session_id = $1
  if (cleanSql.startsWith('SELECT id, parsed_summary') && cleanSql.includes('FROM ai_sessions WHERE session_id = $1')) {
    const sessId = params[0];
    const rows = memoryStore.ai_sessions.filter((a) => a.session_id === sessId);
    return { rows, rowCount: rows.length };
  }

  // UPDATE service_sessions
  if (cleanSql.startsWith('UPDATE service_sessions SET')) {
    const sessId = params[params.length - 1];
    const sess = memoryStore.service_sessions.find((s) => s.id === sessId);
    if (sess) {
      return { rows: [sess], rowCount: 1 };
    }
    return { rows: [memoryStore.service_sessions[0] || {}], rowCount: 1 };
  }

  // INSERT INTO customers
  if (cleanSql.startsWith('INSERT INTO customers')) {
    const newCust = {
      id: uuidv4(),
      name: params[0],
      phone: params[1],
      email: params[2],
      address: params[3],
      notes: params[4],
      created_at: new Date().toISOString(),
    };
    memoryStore.customers.push(newCust);
    return { rows: [newCust], rowCount: 1 };
  }

  // INSERT INTO vehicles
  if (cleanSql.startsWith('INSERT INTO vehicles')) {
    const newVeh = {
      id: uuidv4(),
      customer_id: params[0],
      make: params[1] || 'Honda',
      model: params[2],
      model_code: params[3],
      year: params[4],
      vin: params[5],
      plate_number: params[6],
      mileage_km: params[7],
      color: params[8],
      notes: params[9],
      created_at: new Date().toISOString(),
    };
    memoryStore.vehicles.push(newVeh);
    return { rows: [newVeh], rowCount: 1 };
  }

  // INSERT INTO dtc_records
  if (cleanSql.startsWith('INSERT INTO dtc_records')) {
    const newDTC = {
      id: uuidv4(),
      session_id: params[0],
      dtc_code: params[1],
      status: params[2] || 'active',
      freeze_frame: params[3] || null,
      created_at: new Date().toISOString(),
    };
    memoryStore.dtc_records.push(newDTC);
    return { rows: [newDTC], rowCount: 1 };
  }

  // INSERT INTO live_data_log
  if (cleanSql.startsWith('INSERT INTO live_data_log')) {
    const logId = uuidv4();
    return { rows: [{ id: logId }], rowCount: 1 };
  }

  // Fallback empty result
  return { rows: [], rowCount: 0 };
}

/**
 * Get a client from the pool for transactions
 */
async function getClient() {
  if (isPostgresAvailable && pool) {
    return pool.connect();
  }
  // Mock client for fallback
  return {
    query,
    release: () => {},
  };
}

/**
 * Test database connection
 */
async function testConnection() {
  if (!pool) return false;
  try {
    const res = await pool.query('SELECT NOW() AS now');
    console.log('[DB] Connected to PostgreSQL at:', res.rows[0].now);
    isPostgresAvailable = true;
    return true;
  } catch (err) {
    console.log('[DB] PostgreSQL not reachable (' + err.message + '). Active fallback: In-Memory Database Store.');
    isPostgresAvailable = false;
    return false;
  }
}

/**
 * Graceful shutdown
 */
async function close() {
  if (pool) {
    await pool.end();
    console.log('[DB] Pool closed.');
  }
}

module.exports = {
  pool,
  query,
  getClient,
  migrate,
  testConnection,
  close,
  memoryStore,
};

