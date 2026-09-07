// ============================================
// WRT Garage — DTC Database Routes
// GET /api/dtc-db/:code — Lookup single DTC
// GET /api/dtc-db       — List all DTC codes
// ============================================
const express = require('express');
const router = express.Router();
const dtcDatabase = require('../data/dtc_database.json');

/**
 * GET /api/dtc-db/:code
 * Lookup a specific DTC code
 */
router.get('/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const dtcInfo = dtcDatabase.dtc_database[code];

  if (!dtcInfo) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Kode DTC "${code}" tidak ditemukan dalam database Honda PGM-FI.`,
      suggestion: 'Pastikan format kode benar (contoh: P0113, P0562).',
    });
  }

  res.json({ success: true, data: dtcInfo });
});

/**
 * GET /api/dtc-db
 * List all DTC codes (summary)
 */
router.get('/', (req, res) => {
  const codes = Object.values(dtcDatabase.dtc_database).map((dtc) => ({
    code: dtc.code,
    name: dtc.name,
    sensor: dtc.sensor,
    priority: dtc.priority,
    system_group: dtc.system_group,
  }));

  res.json({
    success: true,
    total: codes.length,
    data: codes,
  });
});

module.exports = router;
