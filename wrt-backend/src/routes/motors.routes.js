// ============================================
// WRT Garage — Motors / ECU Reference Routes
// GET /api/motors — List supported Honda models
// ============================================
const express = require('express');
const router = express.Router();
const ecuDatabase = require('../data/ecu_database.json');

/**
 * GET /api/motors
 * List all supported Honda PGM-FI models
 */
router.get('/', (req, res) => {
  const { model, manufacturer, model_code } = req.query;
  let results = ecuDatabase.ecu_database;

  if (model) {
    results = results.filter((e) => e.model.toLowerCase().includes(model.toLowerCase()));
  }
  if (manufacturer) {
    results = results.filter((e) => e.manufacturer.toLowerCase() === manufacturer.toLowerCase());
  }
  if (model_code) {
    results = results.filter((e) => e.model_code.toLowerCase() === model_code.toLowerCase());
  }

  // Group by model for cleaner response
  const grouped = {};
  for (const ecu of results) {
    if (!grouped[ecu.model]) {
      grouped[ecu.model] = {
        model: ecu.model,
        variants: [],
      };
    }
    grouped[ecu.model].variants.push({
      model_code: ecu.model_code,
      year_start: ecu.year_start,
      year_end: ecu.year_end,
      part_number: ecu.part_number,
      manufacturer: ecu.manufacturer,
      protocol: ecu.protocol,
      init_method: ecu.init_method,
      notes: ecu.notes,
    });
  }

  res.json({
    success: true,
    total_models: Object.keys(grouped).length,
    total_variants: results.length,
    data: Object.values(grouped),
  });
});

/**
 * GET /api/motors/lookup
 * Find ECU by part number
 */
router.get('/lookup', (req, res) => {
  const { part_number } = req.query;
  if (!part_number) {
    return res.status(400).json({ error: 'Query parameter "part_number" required' });
  }

  const matches = ecuDatabase.ecu_database.filter((e) =>
    e.part_number.toLowerCase().includes(part_number.toLowerCase())
  );

  if (matches.length === 0) {
    return res.status(404).json({
      error: 'Not Found',
      message: `ECU dengan part number "${part_number}" tidak ditemukan.`,
    });
  }

  res.json({ success: true, total: matches.length, data: matches });
});

module.exports = router;
