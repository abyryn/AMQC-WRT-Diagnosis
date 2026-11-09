// ============================================
// WRT Garage — AI Diagnosis Service
// Orchestrates 3-Layer Diagnosis Engine
// ============================================
const dtcDatabase = require('../data/dtc_database.json');
const sensorKnowledge = require('../data/sensor_knowledge.json');
const geminiService = require('./gemini.service');
const openrouterService = require('./openrouter.service');
const db = require('../database/db');

function getAiProvider() {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'openrouter') {
    return openrouterService;
  }
  return geminiService;
}

// ============================================
// LAYER 1: Rule Engine — DTC Lookup
// ============================================
function lookupDTC(codes) {
  const tStart = performance.now();
  const results = [];
  for (const code of codes) {
    const dtcInfo = dtcDatabase.dtc_database[code];
    if (dtcInfo) {
      results.push({ ...dtcInfo, found: true });
    } else {
      results.push({
        code,
        found: false,
        name: `Unknown DTC: ${code}`,
        sensor: 'Unknown',
        possible_causes: ['Kode DTC tidak ditemukan dalam database Honda PGM-FI'],
        check_steps: ['Verifikasi kode DTC secara manual', 'Konsultasi dengan manual servis Honda'],
        priority: 'medium',
      });
    }
  }
  const tDuration = performance.now() - tStart;
  const foundCount = results.filter((d) => d.found).length;
  const unknownCount = results.length - foundCount;
  console.log(`[3-Layer:Layer-1] 🔍 lookupDTC() diproses dalam ${tDuration.toFixed(2)}ms (Total: ${codes.length} kode, Ditemukan: ${foundCount}, Tidak Dikenal: ${unknownCount})`);
  return results;
}

// ============================================
// LAYER 2: Knowledge Base — Sensor Validation
// ============================================
function validateSensors(liveData) {
  const tStart = performance.now();
  const anomalies = [];
  const sensorMap = {
    rpm: 'RPM',
    tps_volt: 'TPS',
    map_kpa: 'MAP',
    iat_celsius: 'IAT',
    ect_celsius: 'ECT',
    o2_volt: 'O2',
    battery_volt: 'BATTERY',
    iacv_pct: 'IACV',
    fuel_trim_pct: 'FUEL_TRIM',
  };

  let evaluatedCount = 0;
  for (const [dataKey, sensorKey] of Object.entries(sensorMap)) {
    const value = liveData ? liveData[dataKey] : undefined;
    if (value === undefined || value === null) continue;
    evaluatedCount++;

    const spec = sensorKnowledge.sensors[sensorKey];
    if (!spec) continue;

    const status = {
      sensor: sensorKey,
      name: spec.name,
      value,
      unit: spec.unit,
      status: 'normal',
      detail: null,
    };

    // Check if at fault value
    if (spec.fault_values.includes(value)) {
      status.status = 'fault';
      status.detail = spec.fault_description;
    }
    // Check if below normal idle range
    else if (value < spec.normal_idle_min) {
      status.status = 'below_normal';
      status.detail = spec.interpretation.below_normal;
    }
    // Check if above normal idle range
    else if (value > spec.normal_idle_max) {
      status.status = 'above_normal';
      status.detail = spec.interpretation.above_normal;
    }

    if (status.status !== 'normal') {
      anomalies.push(status);
    }
  }

  const tDuration = performance.now() - tStart;
  console.log(`[3-Layer:Layer-2] 📊 validateSensors() diproses dalam ${tDuration.toFixed(2)}ms (Dievaluasi: ${evaluatedCount} sensor, Anomali: ${anomalies.length})`);
  return anomalies;
}

// ============================================
// LAYER 3: AI Reasoning — Full Diagnosis
// ============================================

/**
 * Run full 3-layer diagnosis
 * @param {Object} payload - Complete diagnosis payload from mobile app
 * @returns {Object} Full diagnosis result with all layers
 */
async function runDiagnosis(payload) {
  const startTotal = performance.now();
  const motorName = payload.motor?.model || payload.motor?.name || payload.motor || 'Honda PGM-FI';

  console.log('\n============================================================');
  console.log(`[3-Layer AI Studio] 🚀 Memulai 3-Layer AI Diagnosis: ${motorName}`);
  console.log(`[3-Layer AI Studio] ⏰ Waktu Mulai: ${new Date().toLocaleTimeString('id-ID')}`);
  console.log('============================================================');

  // --- Layer 1: DTC Lookup ---
  const t1Start = performance.now();
  const allDTCCodes = [
    ...(payload.dtc?.active || []),
    ...(payload.dtc?.pending || []),
  ];
  const dtcResults = lookupDTC(allDTCCodes);
  const t1Duration = performance.now() - t1Start;

  // --- Layer 2: Sensor Validation ---
  const t2Start = performance.now();
  const sensorAnomalies = payload.live_data
    ? validateSensors(payload.live_data)
    : [];
  const t2Duration = performance.now() - t2Start;

  // Build enriched context for AI
  const tCtxStart = performance.now();
  const enrichedContext = buildEnrichedContext(dtcResults, sensorAnomalies, payload);
  const tCtxDuration = performance.now() - tCtxStart;

  // --- Layer 3: AI Reasoning via Configured Provider (Gemini / OpenRouter) ---
  const activeProviderName = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  console.log(`[3-Layer:Layer-3] 🤖 Mengirim context ke AI Provider: ${activeProviderName.toUpperCase()}`);
  const t3Start = performance.now();
  const aiProvider = getAiProvider();
  const aiResult = await aiProvider.diagnose(payload, enrichedContext);
  const t3Duration = performance.now() - t3Start;
  console.log(`[3-Layer:Layer-3] ✅ AI Reasoning selesai dalam ${t3Duration.toFixed(2)}ms (Model: ${aiResult.metadata?.model_used || 'Local Engine'})`);

  // Compose final result
  const totalDuration = performance.now() - startTotal;

  console.log('------------------------------------------------------------');
  console.log('[3-Layer AI Studio] ⏱️ Rekap Waktu Pemrosesan Setiap Fungsi:');
  console.log(`  1. Layer 1 (DTC Rule Engine)   : ${t1Duration.toFixed(2)} ms`);
  console.log(`  2. Layer 2 (Sensor Validation) : ${t2Duration.toFixed(2)} ms`);
  console.log(`  3. Enriched Context Builder    : ${tCtxDuration.toFixed(2)} ms`);
  console.log(`  4. Layer 3 (AI Model Inference): ${t3Duration.toFixed(2)} ms`);
  console.log(`  >> TOTAL WAKTU PROSES SISTEM   : ${totalDuration.toFixed(2)} ms`);
  console.log('============================================================\n');

  return {
    success: aiResult.success,
    layers: {
      layer1_dtc: {
        codes_found: dtcResults.filter((d) => d.found).length,
        codes_unknown: dtcResults.filter((d) => !d.found).length,
        details: dtcResults,
      },
      layer2_sensors: {
        anomalies_count: sensorAnomalies.length,
        anomalies: sensorAnomalies,
      },
      layer3_ai: aiResult.success
        ? aiResult.diagnosis
        : { error: aiResult.error },
    },
    metadata: {
      total_latency_ms: Math.round(totalDuration),
      ai_model: aiResult.metadata.model_used,
      ai_tokens: aiResult.metadata.tokens_used,
      ai_latency_ms: Math.round(t3Duration),
      timings: {
        layer1_dtc_ms: Number(t1Duration.toFixed(2)),
        layer2_sensors_ms: Number(t2Duration.toFixed(2)),
        context_build_ms: Number(tCtxDuration.toFixed(2)),
        layer3_ai_ms: Number(t3Duration.toFixed(2)),
        total_ms: Number(totalDuration.toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build enriched context string from Layer 1 & 2 results
 */
function buildEnrichedContext(dtcResults, sensorAnomalies, payload) {
  const tStart = performance.now();
  let context = '';

  // DTC context
  if (dtcResults.length > 0) {
    context += '=== DTC DATABASE LOOKUP (Layer 1) ===\n';
    for (const dtc of dtcResults) {
      if (dtc.found) {
        context += `\n[${dtc.code}] ${dtc.name}\n`;
        context += `  Sensor: ${dtc.sensor}\n`;
        context += `  Circuit: ${dtc.circuit}\n`;
        context += `  Normal Range: ${dtc.normal_range}\n`;
        context += `  Fault Condition: ${dtc.fault_condition}\n`;
        context += `  Kemungkinan Penyebab:\n`;
        dtc.possible_causes.forEach((c, i) => {
          context += `    ${i + 1}. ${c}\n`;
        });
        context += `  Priority: ${dtc.priority}\n`;
        if (dtc.related_dtc?.length) {
          context += `  Related DTC: ${dtc.related_dtc.join(', ')}\n`;
        }
      } else {
        context += `\n[${dtc.code}] TIDAK DITEMUKAN dalam database Honda PGM-FI\n`;
      }
    }
  }

  // Sensor anomalies context
  if (sensorAnomalies.length > 0) {
    context += '\n=== SENSOR ANOMALI (Layer 2) ===\n';
    for (const anomaly of sensorAnomalies) {
      context += `\n⚠️ ${anomaly.name} (${anomaly.sensor}): ${anomaly.value} ${anomaly.unit}\n`;
      context += `   Status: ${anomaly.status}\n`;
      context += `   Detail: ${anomaly.detail}\n`;
    }
  }

  // Freeze frame context
  if (payload.freeze_frame) {
    context += '\n=== FREEZE FRAME DATA ===\n';
    context += `  DTC Trigger: ${payload.freeze_frame.dtc_trigger}\n`;
    context += `  RPM saat trigger: ${payload.freeze_frame.rpm_at_trigger}\n`;
    context += `  ECT saat trigger: ${payload.freeze_frame.ect_at_trigger}°C\n`;
    context += `  IAT saat trigger: ${payload.freeze_frame.iat_at_trigger}°C\n`;
    context += `  Load saat trigger: ${payload.freeze_frame.load_at_trigger}%\n`;
  }

  // Service history context
  if (payload.service_history) {
    context += '\n=== RIWAYAT SERVIS ===\n';
    if (payload.service_history.last_service_km) {
      context += `  Servis terakhir: ${payload.service_history.last_service_km} km\n`;
    }
    if (payload.service_history.recurring_dtc?.length) {
      context += `  DTC berulang: ${payload.service_history.recurring_dtc.join(', ')}\n`;
    }
  }

  const tDuration = performance.now() - tStart;
  console.log(`[3-Layer:Context] 📝 buildEnrichedContext() selesai dalam ${tDuration.toFixed(2)}ms (${context.length} karakter)`);
  return context;
}

/**
 * Save diagnosis session to database
 */
async function saveDiagnosisSession(sessionId, requestPayload, diagnosisResult) {
  const tStart = performance.now();
  try {
    const result = await db.query(
      `INSERT INTO ai_sessions (session_id, request_json, response_json, parsed_summary, model_used, tokens_used, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        sessionId,
        JSON.stringify(requestPayload),
        JSON.stringify(diagnosisResult.layers.layer3_ai),
        diagnosisResult.layers.layer3_ai?.summary || 'No summary available',
        diagnosisResult.metadata.ai_model,
        diagnosisResult.metadata.ai_tokens,
        diagnosisResult.metadata.ai_latency_ms,
      ]
    );
    const tDuration = performance.now() - tStart;
    console.log(`[3-Layer:Database] 💾 saveDiagnosisSession() selesai dalam ${tDuration.toFixed(2)}ms (Session ID: ${sessionId})`);
    return result.rows[0];
  } catch (error) {
    const tDuration = performance.now() - tStart;
    console.error(`[3-Layer:Database] ❌ Error saving session (${tDuration.toFixed(2)}ms):`, error.message);
    return null;
  }
}

module.exports = {
  lookupDTC,
  validateSensors,
  runDiagnosis,
  saveDiagnosisSession,
  getAiProvider,
};
