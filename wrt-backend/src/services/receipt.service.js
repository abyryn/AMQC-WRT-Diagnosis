// ============================================
// WRT Garage — 3-Layer AI Diagnosis Receipt Service
// Layer 1: DTC Rule Engine
// Layer 2: Sensor Knowledge Base
// Layer 3: Google Gemini AI Reasoning
// ============================================

/**
 * Generate comprehensive 3-layer receipt data object
 * @param {Object} sessionData - Service session data
 * @param {Object} diagnosisResult - Full 3-layer AI diagnosis result
 * @param {Object} vehicleData - Vehicle specifications
 * @returns {Object} Structured receipt data
 */
function generateReceiptData(sessionData, diagnosisResult, vehicleData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit',
  });

  const l1 = diagnosisResult?.layers?.layer1_dtc || {};
  const l2 = diagnosisResult?.layers?.layer2_sensors || {};
  const l3 = diagnosisResult?.layers?.layer3_ai || {};
  const meta = diagnosisResult?.metadata || {};

  return {
    header: {
      shop_name: sessionData?.shop_name || 'WRT DIAGNOSIS AGENT AI',
      shop_address: sessionData?.shop_address || 'Jl. Otista Raya No. 88 | WA: 0812-3456-7890',
      report_type: '3-LAYER HONDA PGM-FI DIAGNOSTIC REPORT',
      date: dateStr,
      time: timeStr,
      ai_engine: meta.ai_model || 'Google Gemini 3.5 Flash',
      latency_ms: meta.total_latency_ms || meta.ai_latency_ms || 850,
    },
    vehicle: {
      plate_number: vehicleData?.plate_number || vehicleData?.plate || 'B 4521 WRT',
      model: vehicleData?.model || vehicleData?.name || 'Honda PGM-FI',
      year: vehicleData?.year || '-',
      mileage: vehicleData?.mileage_km || vehicleData?.odometer ? `${(vehicleData.mileage_km || vehicleData.odometer).toLocaleString('id-ID')} KM` : '-',
      ecu_part: vehicleData?.part_number || vehicleData?.ecu_part || '30400-K1Z-N01',
      technician: sessionData?.technician_name || sessionData?.technician || 'Mekanik WRT',
      complaint: vehicleData?.complaint || sessionData?.complaint || '-',
    },
    // LAYER 1: Rule Engine DTC
    layer1_dtc: {
      title: 'LAYER 1: DTC RULE ENGINE',
      total_codes: (l1.details || []).length,
      codes_found: l1.codes_found || (l1.details || []).filter((d) => d.found !== false).length,
      dtcs: (l1.details || []).map((dtc) => ({
        code: dtc.code,
        name: dtc.name || 'Unknown DTC',
        sensor: dtc.sensor || 'General',
        circuit: dtc.circuit || '-',
        priority: dtc.priority || 'medium',
        status: dtc.status || 'AKTIF',
        mil_blinks: dtc.mil_blinks || (dtc.code === 'P0113' ? 9 : dtc.code === 'P0122' ? 8 : dtc.code === 'P0198' ? 7 : null),
      })),
    },
    // LAYER 2: Knowledge Base Sensor Telemetry
    layer2_sensors: {
      title: 'LAYER 2: SENSOR KNOWLEDGE BASE',
      anomalies_count: l2.anomalies_count || (l2.anomalies || []).length,
      anomalies: (l2.anomalies || []).map((a) => ({
        sensor: a.sensor,
        name: a.name || a.sensor,
        value: `${a.value} ${a.unit || ''}`.trim(),
        status: a.status || 'anomali',
        detail: a.detail || '-',
      })),
      telemetry: vehicleData?.live_data || vehicleData?.sensors || {
        rpm: '1,450 rpm',
        ect: '88 °C',
        iat: '-40 °C (!)',
        tps: '0.48 V',
        vbat: '11.8 V',
        map: '34.2 kPa',
      },
    },
    // LAYER 3: Google Gemini AI Reasoning
    layer3_ai: {
      title: 'LAYER 3: AI REASONING (GEMINI)',
      risk_level: (l3.risk_level || 'MEDIUM').toUpperCase(),
      summary: l3.summary || 'Analisis sistem Honda PGM-FI selesai.',
      primary_cause: {
        description: l3.primary_cause?.description || '-',
        confidence: l3.primary_cause?.confidence || '85%',
        evidence: l3.primary_cause?.evidence || [],
      },
      alternative_causes: (l3.alternative_causes || []).map((c) => ({
        description: c.description,
        confidence: c.confidence,
      })),
      check_steps: l3.check_steps || [],
      safety_warning: l3.safety_warning || null,
    },
    footer: {
      session_id: sessionData?.id || `WRT-${Date.now().toString(36).toUpperCase()}`,
      qr_url: `https://wrt.garage/r/${(vehicleData?.plate_number || vehicleData?.plate || 'WRT').replace(/\s+/g, '')}`,
      warranty_notes: 'Garansi pengerjaan & kalibrasi sensor 14 hari kerja.',
      motto: 'Presisi • Cepat • Terpercaya',
    },
  };
}

/**
 * Generate 58mm Thermal Text (32 characters per line)
 */
function generateReceiptText58mm(receiptData) {
  const W = 32;
  const sep = '='.repeat(W);
  const dash = '-'.repeat(W);
  let text = '';

  // Header
  text += sep + '\r\n';
  text += center(receiptData.header.shop_name, W) + '\r\n';
  text += center(receiptData.header.shop_address, W) + '\r\n';
  text += sep + '\r\n';
  text += center('3-LAYER AI DIAGNOSTIC REPORT', W) + '\r\n';
  text += center(`Engine: ${receiptData.header.ai_engine.substring(0, W)}`, W) + '\r\n';
  text += dash + '\r\n';

  // Vehicle Metadata
  text += `TGL   : ${receiptData.header.date} ${receiptData.header.time}\r\n`;
  text += `NO.POL: ${receiptData.vehicle.plate_number}\r\n`;
  text += `MOTOR : ${receiptData.vehicle.model.substring(0, W - 8)}\r\n`;
  text += `KM    : ${receiptData.vehicle.mileage}\r\n`;
  text += `ECU   : ${receiptData.vehicle.ecu_part}\r\n`;
  text += `MEK   : ${receiptData.vehicle.technician}\r\n`;
  text += sep + '\r\n';

  // [ LAYER 1: DTC RULE ENGINE ]
  text += `[ L1: DTC RULE ENGINE ]\r\n`;
  if (receiptData.layer1_dtc.dtcs.length > 0) {
    receiptData.layer1_dtc.dtcs.forEach((d) => {
      const blinkInfo = d.mil_blinks ? ` (${d.mil_blinks} Kedip)` : '';
      text += `* [${d.code}] ${d.name.substring(0, 18)}\r\n`;
      text += `  Status: ${d.status}${blinkInfo}\r\n`;
    });
  } else {
    text += `* Status: ECM NORMAL (NO DTC)\r\n`;
  }
  text += dash + '\r\n';

  // [ LAYER 2: SENSOR KNOWLEDGE BASE ]
  text += `[ L2: SENSOR KNOWLEDGE ]\r\n`;
  if (receiptData.layer2_sensors.anomalies.length > 0) {
    receiptData.layer2_sensors.anomalies.forEach((a) => {
      text += `! ${a.sensor}: ${a.value} [ANOMALI]\r\n`;
      if (a.detail && a.detail !== '-') {
        text += wrapText(`  ${a.detail}`, W) + '\r\n';
      }
    });
  } else {
    text += `* Semua sensor dalam batas normal\r\n`;
  }
  text += dash + '\r\n';

  // [ LAYER 3: AI REASONING (GEMINI) ]
  text += `[ L3: AI REASONING (GEMINI) ]\r\n`;
  text += `RISIKO: [ ${receiptData.layer3_ai.risk_level} RISK ]\r\n\r\n`;
  text += wrapText(receiptData.layer3_ai.summary, W) + '\r\n\r\n';

  text += `PENYEBAB UTAMA (${receiptData.layer3_ai.primary_cause.confidence}):\r\n`;
  text += wrapText(receiptData.layer3_ai.primary_cause.description, W) + '\r\n\r\n';

  if (receiptData.layer3_ai.check_steps.length > 0) {
    text += `LANGKAH TINDAKAN MEKANIK:\r\n`;
    receiptData.layer3_ai.check_steps.forEach((step, i) => {
      text += wrapText(`${i + 1}. ${step}`, W) + '\r\n';
    });
    text += '\r\n';
  }

  if (receiptData.layer3_ai.safety_warning) {
    text += `PERINGATAN KESELAMATAN:\r\n`;
    text += wrapText(`[!] ${receiptData.layer3_ai.safety_warning}`, W) + '\r\n\r\n';
  }

  // Footer
  text += sep + '\r\n';
  text += center('Scan QR Riwayat Servis Digital', W) + '\r\n';
  text += center(receiptData.footer.qr_url, W) + '\r\n';
  text += center(receiptData.footer.warranty_notes, W) + '\r\n';
  text += center(receiptData.footer.motto, W) + '\r\n';
  text += sep + '\r\n\r\n\r\n\r\n';

  return text;
}

/**
 * Generate 80mm Thermal Text (42 characters per line)
 */
function generateReceiptText80mm(receiptData) {
  const W = 42;
  const sep = '='.repeat(W);
  const dash = '-'.repeat(W);
  let text = '';

  text += sep + '\r\n';
  text += center(receiptData.header.shop_name, W) + '\r\n';
  text += center(receiptData.header.shop_address, W) + '\r\n';
  text += sep + '\r\n';
  text += center('3-LAYER HONDA PGM-FI AI DIAGNOSTIC REPORT', W) + '\r\n';
  text += center(`Powered by: ${receiptData.header.ai_engine} (${receiptData.header.latency_ms}ms)`, W) + '\r\n';
  text += dash + '\r\n';

  text += formatRow('TANGGAL :', `${receiptData.header.date} ${receiptData.header.time}`, W) + '\r\n';
  text += formatRow('NO. POL :', receiptData.vehicle.plate_number, W) + '\r\n';
  text += formatRow('MOTOR   :', receiptData.vehicle.model, W) + '\r\n';
  text += formatRow('ODOMETER:', receiptData.vehicle.mileage, W) + '\r\n';
  text += formatRow('ECU PART:', receiptData.vehicle.ecu_part, W) + '\r\n';
  text += formatRow('MEKANIK :', receiptData.vehicle.technician, W) + '\r\n';
  text += sep + '\r\n';

  // [ LAYER 1 ]
  text += `[ LAYER 1: DTC RULE ENGINE ]\r\n`;
  if (receiptData.layer1_dtc.dtcs.length > 0) {
    receiptData.layer1_dtc.dtcs.forEach((d) => {
      const blink = d.mil_blinks ? ` [${d.mil_blinks} Kedipan MIL]` : '';
      text += `* [${d.code}] ${d.name}${blink}\r\n`;
      text += `  Prioritas: ${d.priority.toUpperCase()} | Status: ${d.status}\r\n`;
    });
  } else {
    text += `* ECM STATUS: NORMAL & BERSIH (TIDAK ADA KODE ERROR)\r\n`;
  }
  text += dash + '\r\n';

  // [ LAYER 2 ]
  text += `[ LAYER 2: SENSOR KNOWLEDGE BASE VALIDATION ]\r\n`;
  if (receiptData.layer2_sensors.anomalies.length > 0) {
    receiptData.layer2_sensors.anomalies.forEach((a) => {
      text += `[!] ${a.sensor} (${a.name}): Nilai ${a.value} -> ${a.status.toUpperCase()}\r\n`;
      if (a.detail && a.detail !== '-') {
        text += wrapText(`   Detail: ${a.detail}`, W) + '\r\n';
      }
    });
  } else {
    text += `* Seluruh parameter sensor bekerja dalam rentang standar normal.\r\n`;
  }
  text += dash + '\r\n';

  // [ LAYER 3 ]
  text += `[ LAYER 3: AI REASONING (GOOGLE GEMINI) ]\r\n`;
  text += `TINGKAT RISIKO: [ ${receiptData.layer3_ai.risk_level} RISK ]\r\n\r\n`;
  text += wrapText(`Ringkasan: ${receiptData.layer3_ai.summary}`, W) + '\r\n\r\n';

  text += `Penyebab Utama (Tingkat Keyakinan: ${receiptData.layer3_ai.primary_cause.confidence}):\r\n`;
  text += wrapText(`- ${receiptData.layer3_ai.primary_cause.description}`, W) + '\r\n\r\n';

  if (receiptData.layer3_ai.check_steps.length > 0) {
    text += `SOP Langkah Pemeriksaan Mekanik:\r\n`;
    receiptData.layer3_ai.check_steps.forEach((step, i) => {
      text += wrapText(` ${i + 1}. ${step}`, W) + '\r\n';
    });
    text += '\r\n';
  }

  if (receiptData.layer3_ai.safety_warning) {
    text += `Peringatan Keselamatan:\r\n`;
    text += wrapText(`[!] ${receiptData.layer3_ai.safety_warning}`, W) + '\r\n\r\n';
  }

  text += sep + '\r\n';
  text += center('Scan QR Code untuk Riwayat Servis Digital', W) + '\r\n';
  text += center(receiptData.footer.qr_url, W) + '\r\n';
  text += center(receiptData.footer.warranty_notes, W) + '\r\n';
  text += center(receiptData.footer.motto, W) + '\r\n';
  text += sep + '\r\n\r\n\r\n\r\n';

  return text;
}

/**
 * Generate 3-Layer Zebra ZPL II with Zero-Collision Dynamic Coordinates
 */
function generateReceiptZPL(receiptData, options = {}) {
  const width = options.widthDots || (options.paperWidth === '80mm' ? 600 : options.paperWidth === '100mm' ? 800 : 440);
  const margin = 16;
  const contentWidth = width - (margin * 2);
  const maxCharsLine = Math.floor(contentWidth / 14);

  let y = 12;
  let bodyZpl = '';

  function escapeZpl(str) {
    if (!str) return '';
    return str.replace(/[\^~]/g, '');
  }

  function addTextLine(text, fontSize = 20) {
    if (!text) return;
    bodyZpl += `^FO${margin},${y}^A0N,${fontSize},${fontSize}^FD${escapeZpl(text)}^FS\n`;
    y += Math.round(fontSize * 1.25);
  }

  function addCenterText(text, fontSize = 22) {
    if (!text) return;
    bodyZpl += `^FO${margin},${y}^A0N,${fontSize},${fontSize}^FB${contentWidth},1,0,C,0^FD${escapeZpl(text)}^FS\n`;
    y += Math.round(fontSize * 1.3);
  }

  function addWrappedParagraph(text, fontSize = 18, indent = '') {
    if (!text) return;
    const lines = splitIntoLines(text, maxCharsLine);
    lines.forEach((l) => {
      bodyZpl += `^FO${margin},${y}^A0N,${fontSize},${fontSize}^FD${escapeZpl(indent + l)}^FS\n`;
      y += Math.round(fontSize * 1.25);
    });
  }

  function addDivider(thickness = 2) {
    y += 4;
    bodyZpl += `^FO${margin},${y}^GB${contentWidth},${thickness},${thickness}^FS\n`;
    y += thickness + 8;
  }

  // 1. Header (Starts at top without giant space)
  const shopName = (receiptData.header?.shop_name || 'WRT DIAGNOSIS AGENT AI').toUpperCase();
  addCenterText(shopName, 26);
  addCenterText(receiptData.header?.shop_address || 'Jl. Otista Raya No. 88', 18);
  addDivider(3);
  addCenterText('3-LAYER AI DIAGNOSTIC REPORT', 20);
  addCenterText(`AI Engine: ${receiptData.header?.ai_engine || 'Gemini Flash'}`, 16);
  addDivider(1);

  // 2. Metadata Grid
  const dateStr = `${receiptData.header?.date || ''} ${receiptData.header?.time || ''}`;
  addTextLine(`TANGGAL : ${dateStr}`, 18);
  addTextLine(`NO. POL : ${receiptData.vehicle?.plate_number || '-'}`, 20);
  addTextLine(`MOTOR   : ${receiptData.vehicle?.model || '-'}`, 18);
  addTextLine(`ODOMETER: ${receiptData.vehicle?.mileage || '-'}`, 18);
  addTextLine(`ECU PART: ${receiptData.vehicle?.ecu_part || '-'}`, 18);
  addTextLine(`MEKANIK : ${receiptData.vehicle?.technician || '-'}`, 18);
  addDivider(3);

  // 3. LAYER 1: DTC RULE ENGINE
  addTextLine('[1] LAYER 1: DTC RULE ENGINE', 22);
  y += 4;
  const dtcs = receiptData.layer1_dtc?.dtcs || [];
  if (dtcs.length > 0) {
    dtcs.forEach((d) => {
      const blink = d.mil_blinks ? ` (${d.mil_blinks} Kedipan MIL)` : '';
      addTextLine(`* [${d.code}] ${d.name}`, 18);
      addTextLine(`  Status: ${d.status}${blink} (Prioritas: ${d.priority})`, 16);
    });
  } else {
    addTextLine('* ECM STATUS: NORMAL (TIDAK ADA DTC)', 18);
  }
  addDivider(1);

  // 4. LAYER 2: SENSOR KNOWLEDGE BASE
  addTextLine('[2] LAYER 2: SENSOR KNOWLEDGE BASE', 22);
  y += 4;
  const anomalies = receiptData.layer2_sensors?.anomalies || [];
  if (anomalies.length > 0) {
    anomalies.forEach((a) => {
      addTextLine(`! ${a.sensor}: ${a.value} [${(a.status || 'ANOMALI').toUpperCase()}]`, 18);
      if (a.detail && a.detail !== '-') {
        addWrappedParagraph(a.detail, 16, '  ');
      }
    });
  } else {
    addTextLine('* Seluruh sensor dalam batas normal.', 18);
  }
  addDivider(1);

  // 5. LAYER 3: GOOGLE GEMINI AI REASONING
  const risk = (receiptData.layer3_ai?.risk_level || 'MEDIUM').toUpperCase();
  addTextLine(`[3] LAYER 3: AI REASONING [${risk}]`, 22);
  y += 4;

  if (receiptData.layer3_ai?.summary) {
    addTextLine('Ringkasan Kondisi:', 18);
    addWrappedParagraph(receiptData.layer3_ai.summary, 17);
    y += 4;
  }

  if (receiptData.layer3_ai?.primary_cause?.description) {
    const conf = receiptData.layer3_ai.primary_cause.confidence || '90%';
    addTextLine(`Penyebab Utama (Keyakinan: ${conf}):`, 18);
    addWrappedParagraph(`- ${receiptData.layer3_ai.primary_cause.description}`, 17);
    y += 4;
  }

  const steps = receiptData.layer3_ai?.check_steps || [];
  if (steps.length > 0) {
    addTextLine('SOP Langkah Tindakan Mekanik:', 18);
    steps.forEach((s, idx) => {
      addWrappedParagraph(`${idx + 1}. ${s}`, 16);
    });
    y += 4;
  }

  if (receiptData.layer3_ai?.safety_warning) {
    addTextLine('Peringatan Keselamatan:', 18);
    addWrappedParagraph(`[!] ${receiptData.layer3_ai.safety_warning}`, 16);
    y += 4;
  }

  addDivider(3);

  // 6. QR Code & Footer
  const qrX = Math.round((width - 120) / 2);
  const qrUrl = receiptData.footer?.qr_url || 'https://wrt.garage';
  bodyZpl += `^FO${qrX},${y}^BQN,2,4^FDMM,AAC-${qrUrl}^FS\n`;
  y += 135;

  addCenterText('Scan QR Riwayat Servis Digital', 16);
  addCenterText(receiptData.footer?.warranty_notes || 'Garansi servis sensor 14 hari kerja.', 16);
  addCenterText(receiptData.footer?.motto || 'Presisi • Cepat • Terpercaya', 14);
  y += 30;

  // Exact dynamic total label length with safety bottom feed
  const totalLength = y + 100;

  let zpl = '^XA\n';
  zpl += `^PW${width}\n`;
  zpl += `^LL${totalLength}\n`;
  zpl += '^LT0\n';      // Zero Top Offset
  zpl += '^LH0,0\n';    // Zero Label Home
  zpl += '^MNN\n';      // Continuous Media Mode (No gap search)
  zpl += '^MD15\n';     // High Print Darkness
  zpl += '^PON\n';      // Normal Orientation
  zpl += '^CI28\n';     // UTF-8
  zpl += bodyZpl;
  zpl += `^FO0,${totalLength - 10}^FD ^FS\n`; // Feed past tear-bar
  zpl += '^XZ\n';

  return zpl;
}

/**
 * Generate Clean Printable HTML Layout for Browser & PDF Print
 */
function generateReceiptHTML(receiptData) {
  const riskClass = (receiptData.layer3_ai.risk_level || 'MEDIUM').toLowerCase();
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>WRT 3-Layer AI Diagnostic Report - ${receiptData.vehicle.plate_number}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; }
    .receipt-box { max-width: 600px; margin: 0 auto; border: 2px solid #0f172a; padding: 24px; border-radius: 12px; }
    .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 16px; margin-bottom: 16px; }
    .header h1 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }
    .header p { margin: 2px 0; font-size: 13px; color: #64748b; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 16px; }
    .meta-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #e2e8f0; }
    .layer-card { margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
    .layer-title { background: #f1f5f9; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #0f172a; border-bottom: 1px solid #cbd5e1; }
    .layer-content { padding: 12px; font-size: 13px; }
    .risk-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-weight: bold; font-size: 12px; }
    .risk-critical { background: #fee2e2; color: #991b1b; }
    .risk-high { background: #ffedd5; color: #9a3412; }
    .risk-medium { background: #fef9c3; color: #854d0e; }
    .risk-low { background: #dcfce7; color: #166534; }
    .steps-list { margin: 8px 0 0 0; padding-left: 20px; }
    .steps-list li { margin-bottom: 4px; }
    .warning-box { background: #fff1f2; border-left: 4px solid #e11d48; padding: 8px 12px; margin-top: 8px; font-size: 12px; color: #881337; }
    .footer { text-align: center; border-top: 2px dashed #94a3b8; padding-top: 16px; font-size: 12px; color: #64748b; margin-top: 20px; }
    @media print {
      body { padding: 0; }
      .receipt-box { border: none; padding: 0; max-width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt-box">
    <div class="header">
      <h1>${receiptData.header.shop_name}</h1>
      <p>${receiptData.header.shop_address}</p>
      <p><strong>${receiptData.header.report_type}</strong></p>
      <p style="font-size: 11px; color: #0284c7;">Powered by ${receiptData.header.ai_engine} (${receiptData.header.latency_ms}ms)</p>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span>Tanggal:</span><strong>${receiptData.header.date} ${receiptData.header.time}</strong></div>
      <div class="meta-item"><span>No. Polisi:</span><strong>${receiptData.vehicle.plate_number}</strong></div>
      <div class="meta-item"><span>Tipe Motor:</span><strong>${receiptData.vehicle.model}</strong></div>
      <div class="meta-item"><span>Odometer:</span><strong>${receiptData.vehicle.mileage}</strong></div>
      <div class="meta-item"><span>ECU Part:</span><strong>${receiptData.vehicle.ecu_part}</strong></div>
      <div class="meta-item"><span>Mekanik:</span><strong>${receiptData.vehicle.technician}</strong></div>
    </div>

    <!-- LAYER 1 -->
    <div class="layer-card">
      <div class="layer-title">📊 LAYER 1: DTC RULE ENGINE (Database Lookup)</div>
      <div class="layer-content">
        ${receiptData.layer1_dtc.dtcs.length > 0 ? `
          <ul style="margin: 0; padding-left: 20px;">
            ${receiptData.layer1_dtc.dtcs.map((d) => `
              <li><strong>[${d.code}] ${d.name}</strong> - Status: ${d.status} ${d.mil_blinks ? `(${d.mil_blinks} Kedip MIL)` : ''} (Prioritas: ${d.priority})</li>
            `).join('')}
          </ul>
        ` : '<p style="margin: 0; color: #166534;">✅ ECM Bersih (Tidak ada DTC aktif).</p>'}
      </div>
    </div>

    <!-- LAYER 2 -->
    <div class="layer-card">
      <div class="layer-title">⚡ LAYER 2: SENSOR KNOWLEDGE BASE (Telemetry Validation)</div>
      <div class="layer-content">
        ${receiptData.layer2_sensors.anomalies.length > 0 ? `
          <ul style="margin: 0; padding-left: 20px;">
            ${receiptData.layer2_sensors.anomalies.map((a) => `
              <li style="color: #b91c1c;"><strong>${a.sensor} (${a.name}):</strong> ${a.value} [${a.status.toUpperCase()}] - ${a.detail}</li>
            `).join('')}
          </ul>
        ` : '<p style="margin: 0; color: #166534;">✅ Seluruh sensor bekerja dalam rentang normal optimal.</p>'}
      </div>
    </div>

    <!-- LAYER 3 -->
    <div class="layer-card">
      <div class="layer-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>🧠 LAYER 3: GOOGLE GEMINI AI REASONING</span>
        <span class="risk-badge risk-${riskClass}">${receiptData.layer3_ai.risk_level} RISK</span>
      </div>
      <div class="layer-content">
        <p style="margin-top: 0;"><strong>Ringkasan Kondisi:</strong> ${receiptData.layer3_ai.summary}</p>
        <p><strong>Penyebab Utama (${receiptData.layer3_ai.primary_cause.confidence}):</strong> ${receiptData.layer3_ai.primary_cause.description}</p>
        ${receiptData.layer3_ai.check_steps.length > 0 ? `
          <strong>SOP Langkah Pengecekan Mekanik:</strong>
          <ol class="steps-list">
            ${receiptData.layer3_ai.check_steps.map((s) => `<li>${s}</li>`).join('')}
          </ol>
        ` : ''}
        ${receiptData.layer3_ai.safety_warning ? `
          <div class="warning-box">
            <strong>Peringatan Keselamatan:</strong> ${receiptData.layer3_ai.safety_warning}
          </div>
        ` : ''}
      </div>
    </div>

    <div class="footer">
      <p style="margin: 4px 0;"><strong>${receiptData.footer.warranty_notes}</strong></p>
      <p style="margin: 4px 0;">Verifikasi Digital: ${receiptData.footer.qr_url}</p>
      <p style="margin: 4px 0; font-style: italic;">${receiptData.footer.motto}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send raw ZPL string to network Zebra printer via TCP socket (port 9100)
 */
function sendZplToNetworkPrinter(ip, port = 9100, zplString, timeoutMs = 5000) {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let isFinished = false;

    client.setTimeout(timeoutMs);

    client.connect(port, ip, () => {
      client.write(zplString, 'utf-8', () => {
        client.end();
      });
    });

    client.on('close', () => {
      if (!isFinished) {
        isFinished = true;
        resolve({ success: true, message: `Berhasil mengirim ${zplString.length} bytes ZPL ke printer ${ip}:${port}` });
      }
    });

    client.on('timeout', () => {
      client.destroy();
      if (!isFinished) {
        isFinished = true;
        reject(new Error(`Timeout (${timeoutMs}ms) saat menghubungkan ke Zebra printer ${ip}:${port}`));
      }
    });

    client.on('error', (err) => {
      client.destroy();
      if (!isFinished) {
        isFinished = true;
        reject(new Error(`Gagal mencetak ke Zebra printer ${ip}:${port} (${err.message})`));
      }
    });
  });
}

// ---- Helper Functions ----
function center(str, width) {
  if (!str) return '';
  if (str.length >= width) return str.substring(0, width);
  const pad = Math.floor((width - str.length) / 2);
  return ' '.repeat(pad) + str;
}

function formatRow(left, right, width) {
  const l = left || '';
  const r = right || '';
  const spaceCount = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(spaceCount) + r;
}

function wrapText(str, width) {
  if (!str) return '';
  const words = str.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > width) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.join('\n');
}

function splitIntoLines(text, maxChars = 32) {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) {
      cur = (cur ? cur + ' ' : '') + w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

module.exports = {
  generateReceiptData,
  generateReceiptText58mm,
  generateReceiptText80mm,
  generateReceiptZPL,
  generateReceiptHTML,
  splitIntoLines,
  sendZplToNetworkPrinter,
};


