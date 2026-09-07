// ============================================
// WRT Garage — Session Service
// CRUD for Service Sessions, Vehicles, Customers
// ============================================
const db = require('../database/db');

// ---- Customers ----
async function createCustomer(data) {
  const result = await db.query(
    `INSERT INTO customers (name, phone, email, address, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, data.phone, data.email, data.address, data.notes]
  );
  return result.rows[0];
}

// ---- Vehicles ----
async function createVehicle(data) {
  const result = await db.query(
    `INSERT INTO vehicles (customer_id, make, model, model_code, year, vin, plate_number, mileage_km, color, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [data.customer_id, data.make || 'Honda', data.model, data.model_code, data.year,
     data.vin, data.plate_number, data.mileage_km, data.color, data.notes]
  );
  return result.rows[0];
}

async function getVehicleById(id) {
  const result = await db.query(
    `SELECT v.*, c.name as customer_name, c.phone as customer_phone,
            e.part_number, e.firmware_version, e.manufacturer as ecu_manufacturer
     FROM vehicles v
     LEFT JOIN customers c ON v.customer_id = c.id
     LEFT JOIN ecu_info e ON v.id = e.vehicle_id
     WHERE v.id = $1`, [id]
  );
  return result.rows[0];
}

// ---- Service Sessions ----
async function createSession(data) {
  const result = await db.query(
    `INSERT INTO service_sessions (vehicle_id, technician_id, mileage_at_svc, complaint, status)
     VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
    [data.vehicle_id, data.technician_id, data.mileage_at_svc, data.complaint]
  );
  return result.rows[0];
}

async function getSessionById(id) {
  const result = await db.query(
    `SELECT ss.*,
            v.model as vehicle_model, v.year as vehicle_year, v.plate_number,
            u.full_name as technician_name
     FROM service_sessions ss
     LEFT JOIN vehicles v ON ss.vehicle_id = v.id
     LEFT JOIN users u ON ss.technician_id = u.id
     WHERE ss.id = $1`, [id]
  );
  if (!result.rows[0]) return null;

  // Get DTC records for this session
  const dtcResult = await db.query(
    `SELECT * FROM dtc_records WHERE session_id = $1 ORDER BY created_at`, [id]
  );

  // Get AI sessions for this session
  const aiResult = await db.query(
    `SELECT id, parsed_summary, model_used, tokens_used, latency_ms, feedback_score, created_at
     FROM ai_sessions WHERE session_id = $1 ORDER BY created_at DESC`, [id]
  );

  return {
    ...result.rows[0],
    dtc_records: dtcResult.rows,
    ai_sessions: aiResult.rows,
  };
}

async function updateSession(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = ['finding', 'action_taken', 'parts_replaced', 'total_cost_idr', 'status', 'finished_at'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      values.push(field === 'parts_replaced' ? JSON.stringify(data[field]) : data[field]);
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

  values.push(id);
  const result = await db.query(
    `UPDATE service_sessions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

async function listSessions(filters = {}) {
  let whereClause = 'WHERE 1=1';
  const params = [];

  if (filters.vehicle_id) {
    params.push(filters.vehicle_id);
    whereClause += ` AND ss.vehicle_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    whereClause += ` AND ss.status = $${params.length}`;
  }

  const limit = Math.min(filters.limit || 20, 100);
  const offset = filters.offset || 0;

  const result = await db.query(
    `SELECT ss.*, v.model as vehicle_model, v.plate_number, u.full_name as technician_name
     FROM service_sessions ss
     LEFT JOIN vehicles v ON ss.vehicle_id = v.id
     LEFT JOIN users u ON ss.technician_id = u.id
     ${whereClause}
     ORDER BY ss.started_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return result.rows;
}

// ---- DTC Records ----
async function saveDTCRecords(sessionId, dtcCodes, freezeFrame) {
  const records = [];
  for (const code of dtcCodes.active || []) {
    const result = await db.query(
      `INSERT INTO dtc_records (session_id, dtc_code, status, freeze_frame)
       VALUES ($1, $2, 'active', $3) RETURNING *`,
      [sessionId, code, freezeFrame ? JSON.stringify(freezeFrame) : null]
    );
    records.push(result.rows[0]);
  }
  for (const code of dtcCodes.pending || []) {
    const result = await db.query(
      `INSERT INTO dtc_records (session_id, dtc_code, status)
       VALUES ($1, $2, 'pending') RETURNING *`,
      [sessionId, code]
    );
    records.push(result.rows[0]);
  }
  return records;
}

// ---- Live Data Log ----
async function saveLiveDataLog(sessionId, liveData) {
  const result = await db.query(
    `INSERT INTO live_data_log (session_id, rpm, tps_volt, map_kpa, iat_celsius, ect_celsius, o2_volt, battery_volt, iacv_pct, fuel_trim_pct, vehicle_speed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [sessionId, liveData.rpm, liveData.tps_volt, liveData.map_kpa, liveData.iat_celsius,
     liveData.ect_celsius, liveData.o2_volt, liveData.battery_volt, liveData.iacv_pct,
     liveData.fuel_trim_pct, liveData.vehicle_speed]
  );
  return result.rows[0];
}

module.exports = {
  createCustomer,
  createVehicle,
  getVehicleById,
  createSession,
  getSessionById,
  updateSession,
  listSessions,
  saveDTCRecords,
  saveLiveDataLog,
};
