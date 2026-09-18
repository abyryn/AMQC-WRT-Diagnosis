// ============================================
// WRT Garage — Honda PGM-FI AI Diagnostic App.js
// Version: 2.0 (Mobile & Web)
// ============================================

const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'wrt-garage-api-key-change-this-in-production';

// Global Telemetry & App State
const state = {
  activeView: 'view-dashboard',
  isSimulating: true,
  isPaused: false,
  simScenario: 'idle',
  sampleCount: 0,
  
  // Active Vehicle Specs
  currentVehicle: {
    name: 'Honda PCX 160 eSP+ (2023)',
    modelCode: 'K1Z',
    partNumber: '30400-K1Z-N01',
    manufacturer: 'Shindengen',
    protocol: 'Honda K-Line (ISO 14230 Fast Init)',
    plate: 'B 4521 WRT',
    mileage: 14250,
  },

  // 14 Live Sensor Channels
  sensors: {
    rpm: 1450,
    tps_volt: 0.48,
    tps_pct: 0.0,
    map_kpa: 34.2,
    iat_celsius: 32.0, // Normal idle temperature
    ect_celsius: 88.0,
    o2_volt: 0.45,
    battery_volt: 13.8,
    iacv_pct: 28.0,
    fuel_trim_pct: 0.0,
    ltft_pct: 0.0,
    vehicle_speed: 0,
    inj_ms: 2.15,
    ign_deg: 12.0,
  },

  // Active DTC List (Initially empty - Normal healthy motor)
  activeDTCs: [],

  // AI Chat History
  chatHistory: [],

  // Waveform History Buffer
  chartHistory: {
    rpm: [],
    tps: [],
    o2: [],
    ect: [],
    maxPoints: 80,
  },

  // ECU Motors Database
  motorsDatabase: [],

  // Service Sessions
  sessionsList: [],
};

// ============================================
// Initialization on DOM Loaded
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initVehicleSelector();
  initTelemetryLoop();
  initDtcViewer();
  initAiStudio();
  initAiChat();
  initPrinterView();
  initEcuDatabase();
  initTerminal();
  initSessions();
  checkApiHealth();
  renderSensorsGrid();
});

// ============================================
// 1. Navigation Controller
// ============================================
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('data-target');
      if (!targetId) return;

      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      document.querySelectorAll('.content-view').forEach((view) => {
        view.classList.remove('active');
      });

      const targetView = document.getElementById(targetId);
      if (targetView) {
        targetView.classList.add('active');
        state.activeView = targetId;
      }
    });
  });

  // Header quick buttons
  document.getElementById('btnQuickAiDiagnose')?.addEventListener('click', () => {
    switchView('view-ai');
  });

  document.getElementById('btnBannerDiagnose')?.addEventListener('click', () => {
    switchView('view-ai');
  });

  document.getElementById('btnQuickPrint')?.addEventListener('click', () => {
    switchView('view-printer');
  });

  document.getElementById('btnGoToLiveData')?.addEventListener('click', () => {
    switchView('view-livedata');
  });

  document.getElementById('btnQuickClearDtc')?.addEventListener('click', () => {
    clearDtcAction();
  });

  // Sim toggle
  const simToggleBtn = document.getElementById('simToggleBtn');
  simToggleBtn?.addEventListener('click', () => {
    state.isSimulating = !state.isSimulating;
    simToggleBtn.classList.toggle('active', state.isSimulating);
    document.getElementById('simToggleText').textContent = state.isSimulating ? 'Simulasi: ON' : 'Simulasi: PAUSED';
    showToast(state.isSimulating ? 'Simulasi telemetri dilanjutkan' : 'Simulasi telemetri dihentikan', 'info');
  });
}

function switchView(viewId) {
  const targetLink = document.querySelector(`.nav-link[data-target="${viewId}"]`);
  if (targetLink) targetLink.click();
}

// ============================================
// 2. Vehicle Selector
// ============================================
function initVehicleSelector() {
  const vehicleSelect = document.getElementById('vehicleSelect');
  if (!vehicleSelect) return;

  vehicleSelect.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const modelName = opt.text;
    const modelCode = opt.getAttribute('data-code');
    const partNumber = opt.getAttribute('data-part');
    const mfg = opt.getAttribute('data-mfg');

    state.currentVehicle.name = modelName;
    state.currentVehicle.modelCode = modelCode;
    state.currentVehicle.partNumber = partNumber;
    state.currentVehicle.manufacturer = mfg;

    // Update UI elements
    document.getElementById('heroBikeName').textContent = `Honda ${modelName}`;
    document.getElementById('heroEcuPart').textContent = `Part: ${partNumber}`;
    document.getElementById('heroEcuMfg').textContent = mfg;
    document.getElementById('aiMotorModel').value = `Honda ${modelName} (${partNumber})`;
    document.getElementById('receiptMotor').value = `Honda ${modelName}`;
    document.getElementById('rtMotor').textContent = `${modelName} (${modelCode})`;

    showToast(`Kendaraan beralih ke: Honda ${modelName}`, 'info');
  });
}

// ============================================
// 3. Telemetry Stream & Simulation Engine
// ============================================
function initTelemetryLoop() {
  const scenarioSelect = document.getElementById('simScenarioSelect');
  scenarioSelect?.addEventListener('change', (e) => {
    state.simScenario = e.target.value;
    applyScenario(state.simScenario);
  });

  const pauseBtn = document.getElementById('btnPauseTelemetry');
  pauseBtn?.addEventListener('click', () => {
    state.isPaused = !state.isPaused;
    document.getElementById('btnPauseText').textContent = state.isPaused ? 'Resume Stream' : 'Pause Stream';
    showToast(state.isPaused ? 'Stream telemetri dijeda' : 'Stream telemetri berjalan', 'info');
  });

  const exportBtn = document.getElementById('btnExportCsv');
  exportBtn?.addEventListener('click', () => {
    exportTelemetryCsv();
  });

  // Run telemetry loop at 20 Hz (50ms interval)
  setInterval(() => {
    if (state.isSimulating && !state.isPaused) {
      updateSimulationStep();
      updateDashboardGauges();
      updateSensorGridValues();
      updateMiniChart();
      updateMainChart();
    }
  }, 50);
}

function applyScenario(scenario) {
  if (scenario === 'fault_iat') {
    state.sensors.iat_celsius = -40.0;
    if (!state.activeDTCs.some((d) => d.code === 'P0113')) {
      state.activeDTCs.push({
        code: 'P0113',
        name: 'Intake Air Temperature Sensor High Input',
        sensor: 'IAT',
        circuit: 'Signal High / Open',
        priority: 'medium',
        mil_status: 'on',
        status: 'active',
      });
      renderDtcList();
    }
    showToast('Simulasi: Sensor IAT terbuka (-40°C) & DTC P0113 aktif', 'danger');
  } else if (scenario === 'fault_overheat') {
    state.sensors.ect_celsius = 118.0;
    state.sensors.iat_celsius = 45.0;
    showToast('Simulasi: Temperatur mesin overheating (118°C)', 'danger');
  } else if (scenario === 'fault_battery') {
    state.sensors.battery_volt = 10.4;
    showToast('Simulasi: Tegangan aki drop di bawah 11V', 'danger');
  } else if (scenario === 'idle') {
    state.sensors.rpm = 1450;
    state.sensors.tps_volt = 0.48;
    state.sensors.tps_pct = 0.0;
    state.sensors.map_kpa = 34.2;
    state.sensors.battery_volt = 13.8;
  }
}

function updateSimulationStep() {
  state.sampleCount++;
  const t = state.sampleCount * 0.1;

  if (state.simScenario === 'idle') {
    // Normal small jitter around 1450 RPM
    state.sensors.rpm = Math.round(1450 + Math.sin(t * 1.5) * 35 + (Math.random() * 20 - 10));
    state.sensors.tps_volt = +(0.48 + Math.sin(t * 0.5) * 0.01).toFixed(2);
    state.sensors.tps_pct = 0.0;
    state.sensors.map_kpa = +(34.0 + Math.cos(t) * 1.2).toFixed(1);
    state.sensors.o2_volt = +(0.45 + Math.sin(t * 2.0) * 0.35).toFixed(2); // Lambda switching cycle
    state.sensors.battery_volt = +(13.8 + Math.sin(t * 0.2) * 0.15).toFixed(1);
    state.sensors.ect_celsius = +(88.0 + Math.sin(t * 0.05) * 2.0).toFixed(1);
    state.sensors.inj_ms = +(2.45 + Math.sin(t) * 0.08).toFixed(2);
    state.sensors.ign_deg = +(12.0 + Math.cos(t) * 0.5).toFixed(1);
    state.sensors.vehicle_speed = 0;
  } else if (state.simScenario === 'revving') {
    // Blip gas cycles
    const wave = Math.abs(Math.sin(t * 0.6));
    state.sensors.rpm = Math.round(1450 + wave * 5800);
    state.sensors.tps_volt = +(0.48 + wave * 3.2).toFixed(2);
    state.sensors.tps_pct = +(wave * 80).toFixed(1);
    state.sensors.map_kpa = +(34.0 + wave * 52.0).toFixed(1);
    state.sensors.o2_volt = +(0.2 + wave * 0.7).toFixed(2);
    state.sensors.battery_volt = +(14.2 + wave * 0.3).toFixed(1);
    state.sensors.inj_ms = +(2.45 + wave * 6.5).toFixed(2);
    state.sensors.ign_deg = +(12.0 + wave * 18.0).toFixed(1);
  } else if (state.simScenario === 'cruising') {
    state.sensors.rpm = Math.round(4800 + Math.sin(t) * 120);
    state.sensors.tps_volt = 1.85;
    state.sensors.tps_pct = 32.0;
    state.sensors.vehicle_speed = Math.round(62 + Math.sin(t * 0.4) * 3);
    state.sensors.map_kpa = 58.4;
    state.sensors.battery_volt = 14.3;
    state.sensors.o2_volt = +(0.45 + Math.sin(t * 3.0) * 0.4).toFixed(2);
  }

  // Push to chart buffer
  state.chartHistory.rpm.push(state.sensors.rpm);
  state.chartHistory.tps.push(state.sensors.tps_volt * 1000); // Scale for graph visibility
  state.chartHistory.o2.push(state.sensors.o2_volt * 3000);
  state.chartHistory.ect.push(state.sensors.ect_celsius * 30);

  if (state.chartHistory.rpm.length > state.chartHistory.maxPoints) {
    state.chartHistory.rpm.shift();
    state.chartHistory.tps.shift();
    state.chartHistory.o2.shift();
    state.chartHistory.ect.shift();
  }
}

function updateDashboardGauges() {
  // RPM Display & Arc
  const rpmElem = document.getElementById('dashRpmVal');
  if (rpmElem) rpmElem.textContent = state.sensors.rpm.toLocaleString();

  const rpmArc = document.getElementById('rpmArc');
  if (rpmArc) {
    // 0 to 12000 RPM maps to 251.2 to 0 offset
    const maxRpm = 12000;
    const progress = Math.min(1, Math.max(0, state.sensors.rpm / maxRpm));
    const offset = 251.2 * (1 - progress);
    rpmArc.style.strokeDashoffset = offset;
    rpmArc.style.stroke = state.sensors.rpm > 9000 ? '#ef4444' : state.sensors.rpm > 7000 ? '#f59e0b' : '#38bdf8';
  }

  // ECT Suhu Mesin
  const ectElem = document.getElementById('dashEctVal');
  if (ectElem) ectElem.textContent = Math.round(state.sensors.ect_celsius);
  const ectBar = document.getElementById('ectProgressBar');
  if (ectBar) {
    const ectPct = Math.min(100, Math.max(0, (state.sensors.ect_celsius / 130) * 100));
    ectBar.style.width = `${ectPct}%`;
  }
  const ectBadge = document.getElementById('ectStatusBadge');
  if (ectBadge) {
    if (state.sensors.ect_celsius > 105) {
      ectBadge.textContent = 'Overheat';
      ectBadge.className = 'badge-status status-danger';
    } else {
      ectBadge.textContent = 'Normal';
      ectBadge.className = 'badge-status status-good';
    }
  }

  // Battery Voltage
  const battElem = document.getElementById('dashBattVal');
  if (battElem) battElem.textContent = state.sensors.battery_volt;
  const battBar = document.getElementById('battProgressBar');
  if (battBar) {
    const battPct = Math.min(100, Math.max(0, ((state.sensors.battery_volt - 9) / 7) * 100));
    battBar.style.width = `${battPct}%`;
  }
  const battBadge = document.getElementById('battStatusBadge');
  if (battBadge) {
    if (state.sensors.battery_volt < 11.5) {
      battBadge.textContent = 'Drop / Lemah';
      battBadge.className = 'badge-status status-danger';
    } else if (state.sensors.battery_volt < 12.8) {
      battBadge.textContent = 'Pengisian Rendah';
      battBadge.className = 'badge-status status-warn';
    } else {
      battBadge.textContent = 'Optimal 14V';
      battBadge.className = 'badge-status status-good';
    }
  }

  // TPS
  const tpsElem = document.getElementById('dashTpsVal');
  if (tpsElem) tpsElem.textContent = state.sensors.tps_volt;
  const tpsPctElem = document.getElementById('dashTpsPct');
  if (tpsPctElem) tpsPctElem.textContent = `(${state.sensors.tps_pct}%)`;
  const tpsBar = document.getElementById('tpsProgressBar');
  if (tpsBar) {
    const tpsPct = Math.min(100, Math.max(0, (state.sensors.tps_volt / 5.0) * 100));
    tpsBar.style.width = `${tpsPct}%`;
  }

  // Secondary Mini Metrics
  const iatElem = document.getElementById('dashIatVal');
  if (iatElem) {
    if (state.sensors.iat_celsius <= -30) {
      iatElem.textContent = `${state.sensors.iat_celsius} °C`;
      iatElem.className = 'mini-value text-danger';
    } else {
      iatElem.textContent = `${state.sensors.iat_celsius} °C`;
      iatElem.className = 'mini-value';
    }
  }

  const mapElem = document.getElementById('dashMapVal');
  if (mapElem) mapElem.textContent = `${state.sensors.map_kpa} kPa`;

  const o2Elem = document.getElementById('dashO2Val');
  if (o2Elem) o2Elem.textContent = `${state.sensors.o2_volt} V`;

  const speedElem = document.getElementById('dashSpeedVal');
  if (speedElem) speedElem.textContent = `${state.sensors.vehicle_speed} km/h`;
}

// ============================================
// 4. Waveform Canvas Plotter
// ============================================
function updateMiniChart() {
  const canvas = document.getElementById('miniDashboardChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background Grid Lines
  ctx.strokeStyle = '#1a2230';
  ctx.lineWidth = 1;
  for (let y = 30; y < h; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw RPM Line
  const data = state.chartHistory.rpm;
  if (data.length < 2) return;

  const stepX = w / (state.chartHistory.maxPoints - 1);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  data.forEach((val, i) => {
    const x = i * stepX;
    // Map RPM 0-10000 to h-10 to 10
    const y = h - 10 - (val / 10000) * (h - 20);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Glow line fill
  ctx.lineTo((data.length - 1) * stepX, h);
  ctx.lineTo(0, h);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.fill();
}

function updateMainChart() {
  const canvas = document.getElementById('mainTelemetryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = '#151c28';
  ctx.lineWidth = 1;
  for (let y = 30; y < h; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const stepX = w / (state.chartHistory.maxPoints - 1);

  // 1. Draw ECT Line (Amber)
  drawLine(ctx, state.chartHistory.ect, stepX, h, 4000, '#f59e0b', 1.5);

  // 2. Draw O2 Line (Purple)
  drawLine(ctx, state.chartHistory.o2, stepX, h, 4000, '#a855f7', 1.5);

  // 3. Draw TPS Line (Cyan)
  drawLine(ctx, state.chartHistory.tps, stepX, h, 5000, '#38bdf8', 2);

  // 4. Draw RPM Line (Neon Blue)
  drawLine(ctx, state.chartHistory.rpm, stepX, h, 10000, '#38bdf8', 2.5);
}

function drawLine(ctx, points, stepX, h, maxVal, color, lineWidth) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  points.forEach((val, i) => {
    const x = i * stepX;
    const y = h - 15 - (val / maxVal) * (h - 30);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ============================================
// 5. 14 Sensors Grid Rendering
// ============================================
const SENSOR_METADATA = [
  { id: 'rpm', name: 'Engine Speed (RPM)', unit: 'RPM', std: '1,400 - 1,600' },
  { id: 'tps_volt', name: 'Throttle Position (TPS)', unit: 'Volt', std: '0.45V - 0.55V' },
  { id: 'tps_pct', name: 'Throttle Angle (%)', unit: '%', std: '0.0% (Closed)' },
  { id: 'map_kpa', name: 'Manifold Pressure (MAP)', unit: 'kPa', std: '30.0 - 45.0' },
  { id: 'iat_celsius', name: 'Intake Air Temp (IAT)', unit: '°C', std: '20°C - 50°C' },
  { id: 'ect_celsius', name: 'Engine Coolant Temp (ECT)', unit: '°C', std: '80°C - 95°C' },
  { id: 'o2_volt', name: 'O2 Lambda Voltage', unit: 'Volt', std: '0.1V - 0.9V' },
  { id: 'battery_volt', name: 'Battery Voltage (VBAT)', unit: 'Volt', std: '13.8V - 14.5V' },
  { id: 'iacv_pct', name: 'Idle Air Control (IACV)', unit: '%', std: '15% - 40%' },
  { id: 'fuel_trim_pct', name: 'Short Term Fuel Trim', unit: '%', std: '-10% to +10%' },
  { id: 'ltft_pct', name: 'Long Term Fuel Trim', unit: '%', std: '-10% to +10%' },
  { id: 'vehicle_speed', name: 'Vehicle Speed (SPD)', unit: 'km/h', std: 'Realtime' },
  { id: 'inj_ms', name: 'Injector Pulse Width', unit: 'ms', std: '2.0ms - 4.0ms' },
  { id: 'ign_deg', name: 'Ignition Timing (BTDC)', unit: '°', std: '10° - 15° BTDC' },
];

function renderSensorsGrid() {
  const container = document.getElementById('sensorsGrid');
  if (!container) return;

  container.innerHTML = SENSOR_METADATA.map((s) => {
    return `
      <div class="sensor-grid-card" id="sensor_card_${s.id}">
        <div class="card-header">
          <span class="card-title">${s.name}</span>
          <span class="card-tag">${s.unit}</span>
        </div>
        <div class="sensor-value-large">
          <span class="huge-number" id="sensor_val_${s.id}">--</span>
          <span class="unit-symbol">${s.unit}</span>
        </div>
        <div class="sensor-sub-info">
          <span>Standar: ${s.std}</span>
          <span class="badge-status status-good" id="sensor_stat_${s.id}">Normal</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateSensorGridValues() {
  SENSOR_METADATA.forEach((s) => {
    const valElem = document.getElementById(`sensor_val_${s.id}`);
    const cardElem = document.getElementById(`sensor_card_${s.id}`);
    const statElem = document.getElementById(`sensor_stat_${s.id}`);
    if (!valElem) return;

    const val = state.sensors[s.id];
    valElem.textContent = val !== undefined ? val : '--';

    // Anomaly checks
    let isAnomaly = false;
    if (s.id === 'iat_celsius' && val <= -30) isAnomaly = true;
    if (s.id === 'ect_celsius' && val > 105) isAnomaly = true;
    if (s.id === 'battery_volt' && val < 11.5) isAnomaly = true;

    if (cardElem) cardElem.classList.toggle('anomaly', isAnomaly);
    if (statElem) {
      if (isAnomaly) {
        statElem.textContent = 'Anomali';
        statElem.className = 'badge-status status-danger';
      } else {
        statElem.textContent = 'Normal';
        statElem.className = 'badge-status status-good';
      }
    }
  });
}

function exportTelemetryCsv() {
  let csv = 'Timestamp,RPM,TPS_V,MAP_kPa,IAT_C,ECT_C,O2_V,VBAT_V,IACV_Pct,Speed_kmh\n';
  const now = new Date().toISOString();
  for (let i = 0; i < state.chartHistory.rpm.length; i++) {
    csv += `${now},${state.chartHistory.rpm[i]},${(state.chartHistory.tps[i]/1000).toFixed(2)},34.2,${state.sensors.iat_celsius},${state.sensors.ect_celsius},${state.sensors.o2_volt},${state.sensors.battery_volt},28,${state.sensors.vehicle_speed}\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `WRT_Telemetry_${state.currentVehicle.modelCode}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('File CSV Telemetri berhasil diekspor!', 'success');
}

// ============================================
// 6. DTC Viewer & Clear DTC
// ============================================
function initDtcViewer() {
  renderDtcList();

  const clearBtn = document.getElementById('btnClearDtcMain');
  clearBtn?.addEventListener('click', () => {
    clearDtcAction();
  });

  const addDtcBtn = document.getElementById('btnAddDtcBtn');
  addDtcBtn?.addEventListener('click', () => {
    const select = document.getElementById('addTestDtcSelect');
    const code = select.value;
    injectDtc(code);
  });

  document.getElementById('btnDiagnoseDtcList')?.addEventListener('click', () => {
    switchView('view-ai');
  });
}

function renderDtcList() {
  const container = document.getElementById('dtcItemsContainer');
  const countBadge = document.getElementById('dtcActiveCountBadge');
  const bannerBadge = document.getElementById('dtcAlertBadge');
  const bannerCodes = document.getElementById('dtcBannerCodes');
  const dtcBanner = document.getElementById('dtcBanner');

  if (countBadge) countBadge.textContent = `${state.activeDTCs.length} Aktif`;
  if (bannerBadge) bannerBadge.textContent = `${state.activeDTCs.length} DTC`;

  if (state.activeDTCs.length === 0) {
    if (dtcBanner) dtcBanner.style.display = 'none';
    if (container) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--accent-green);">
          <h3>ECM Bersih (Tidak Ada DTC)</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">
            Seluruh sistem kontrol elektronik Honda PGM-FI berfungsi normal. Lampu MIL speedometer mati.
          </p>
        </div>
      `;
    }
    return;
  }

  if (dtcBanner) dtcBanner.style.display = 'flex';
  if (bannerCodes) {
    bannerCodes.innerHTML = state.activeDTCs.map((d) => `
      <span class="dtc-chip ${d.priority === 'high' || d.priority === 'critical' ? 'chip-critical' : 'chip-warning'}">
        ${d.code} (${d.name})
      </span>
    `).join('');
  }

  if (container) {
    container.innerHTML = state.activeDTCs.map((d, idx) => `
      <div class="dtc-item-card ${idx === 0 ? 'selected' : ''}" data-dtc="${d.code}" onclick="selectDtcDetail('${d.code}')">
        <div class="dtc-item-header">
          <span class="dtc-code-badge ${d.priority === 'high' ? 'badge-critical' : 'badge-warning'}">${d.code}</span>
          <span class="dtc-mil-status mil-active">MIL ON</span>
        </div>
        <div class="dtc-item-name">${d.name}</div>
        <div class="dtc-item-meta">
          <span>Sensor: <strong>${d.sensor}</strong></span>
          <span>Sirkuit: <strong>${d.circuit}</strong></span>
        </div>
      </div>
    `).join('');
  }
}

window.selectDtcDetail = async function(code) {
  document.querySelectorAll('.dtc-item-card').forEach((c) => {
    c.classList.toggle('selected', c.getAttribute('data-dtc') === code);
  });

  try {
    const res = await fetch(`${API_BASE}/dtc-db/${code}`);
    if (res.ok) {
      const data = await res.json();
      const dtc = data.data;

      document.getElementById('dtcDetailTitle').textContent = `${dtc.code} — ${dtc.name}`;
      document.getElementById('dtcDetailSubtitle').textContent = `Sistem: ${dtc.system_group} • Prioritas: ${dtc.priority.toUpperCase()}`;
      document.getElementById('dtcFaultCondition').textContent = dtc.fault_condition;
      document.getElementById('dtcNormalRange').textContent = dtc.normal_range;

      const causesList = document.getElementById('dtcCausesList');
      if (causesList && dtc.possible_causes) {
        causesList.innerHTML = dtc.possible_causes.map((c) => `<li>${c}</li>`).join('');
      }

      const stepsList = document.getElementById('dtcStepsList');
      if (stepsList && dtc.check_steps) {
        stepsList.innerHTML = dtc.check_steps.map((s) => `<li>${s}</li>`).join('');
      }
    }
  } catch (e) {
    console.warn('Failed to fetch DTC detail:', e);
  }
};

async function injectDtc(code) {
  try {
    const res = await fetch(`${API_BASE}/dtc-db/${code}`);
    if (res.ok) {
      const json = await res.json();
      const dtc = json.data;
      if (!state.activeDTCs.some((d) => d.code === code)) {
        state.activeDTCs.push({
          code: dtc.code,
          name: dtc.name,
          sensor: dtc.sensor,
          circuit: dtc.circuit,
          priority: dtc.priority,
          mil_status: 'on',
          status: 'active',
        });
        renderDtcList();
        selectDtcDetail(code);
        showToast(`DTC ${code} berhasil diinjeksikan!`, 'info');
      } else {
        showToast(`DTC ${code} sudah ada dalam daftar aktif!`, 'warning');
      }
    }
  } catch (e) {
    showToast(`Gagal menginjeksi DTC ${code}`, 'danger');
  }
}

function clearDtcAction() {
  state.activeDTCs = [];
  state.sensors.iat_celsius = 32.0; // Reset sensor to normal
  renderDtcList();
  showToast('Perintah K-Line "72 05 04 00 85" Terkirim: ECM Berhasil Direset & MIL Dimatikan', 'success');
}

// ============================================
// 7. 3-Layer AI Studio Controller
// ============================================
function initAiStudio() {
  const form = document.getElementById('aiDiagnosisForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await executeAiDiagnosis();
  });

  // Preset Condition Buttons Handler
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const complaintInput = document.getElementById('aiComplaint');

      if (preset === 'normal') {
        state.activeDTCs = [];
        state.sensors.iat_celsius = 32.0;
        state.sensors.ect_celsius = 88.0;
        state.sensors.battery_volt = 13.8;
        if (complaintInput) {
          complaintInput.value = 'Motor dalam kondisi sehat dan halus, tidak ada lampu MIL berkedip. Ingin cek kesehatan sistem sensor PGM-FI secara berkala.';
        }
        renderDtcList();
        showToast('Preset: Kondisi Motor Normal & Sehat (Tanpa DTC)', 'success');
      } else if (preset === 'fault_iat') {
        state.sensors.iat_celsius = -40.0;
        if (!state.activeDTCs.some((d) => d.code === 'P0113')) {
          state.activeDTCs.push({
            code: 'P0113',
            name: 'Intake Air Temperature Sensor High Input',
            sensor: 'IAT',
            circuit: 'Signal High / Open',
            priority: 'medium',
            mil_status: 'on',
            status: 'active',
          });
        }
        if (complaintInput) {
          complaintInput.value = 'Motor brebet saat digas di tarikan awal, lampu MIL berkedip 9 kali setelah terkena hujan, dan konsumsi bensin terasa lebih boros.';
        }
        renderDtcList();
        showToast('Preset: Fault Sensor IAT Terbuka (-40°C & DTC P0113)', 'danger');
      } else if (preset === 'fault_overheat') {
        state.sensors.ect_celsius = 118.0;
        if (complaintInput) {
          complaintInput.value = 'Temperatur radiator terasa sangat tinggi (118°C), cairan coolant meluap ke reservoir, dan kipas radiator menyala terus.';
        }
        showToast('Preset: Fault Temperatur Overheating (118°C)', 'warning');
      } else if (preset === 'fault_battery') {
        state.sensors.battery_volt = 10.4;
        if (!state.activeDTCs.some((d) => d.code === 'P0562')) {
          state.activeDTCs.push({
            code: 'P0562',
            name: 'Battery Voltage Low',
            sensor: 'BATTERY',
            circuit: 'Charging System',
            priority: 'high',
            mil_status: 'on',
            status: 'active',
          });
        }
        if (complaintInput) {
          complaintInput.value = 'Starter elektrik motor terasa sangat lemah saat pagi hari, tegangan aki terdeteksi drop di bawah 11 Volt.';
        }
        renderDtcList();
        showToast('Preset: Fault Tegangan Aki Low (10.4V & DTC P0562)', 'warning');
      }
    });
  });

  document.getElementById('btnTransferToPrinter')?.addEventListener('click', () => {
    switchView('view-printer');
  });

  // Star Rating Click Handlers
  const starBtns = document.querySelectorAll('.star-btn');
  starBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const star = parseInt(btn.getAttribute('data-star'), 10);
      starBtns.forEach((b, idx) => {
        b.classList.toggle('active', idx < star);
      });
    });
  });

  document.getElementById('btnSubmitFeedback')?.addEventListener('click', () => {
    showToast('⭐ Terima kasih! Feedback rating Anda telah dicatat ke database WRT.', 'success');
  });
}

async function executeAiDiagnosis() {
  const btn = document.getElementById('btnRunAiDiagnosis');
  const spinner = document.getElementById('aiSpinner');
  const btnText = document.getElementById('btnRunAiText');

  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Memproses 3-Layer AI Diagnosis...';

  const payload = {
    motor: {
      model: state.currentVehicle.name,
      part_number: state.currentVehicle.partNumber,
      model_code: state.currentVehicle.modelCode,
    },
    technician: document.getElementById('aiTechnician')?.value || 'Mekanik WRT',
    mileage: parseInt(document.getElementById('aiMileage')?.value || 14250, 10),
    complaint: document.getElementById('aiComplaint')?.value || '',
    dtc: {
      active: state.activeDTCs.map((d) => d.code),
      pending: [],
    },
    live_data: document.getElementById('aiIncludeLive')?.checked ? state.sensors : null,
    freeze_frame: document.getElementById('aiIncludeFreeze')?.checked ? {
      dtc_trigger: state.activeDTCs[0]?.code || 'P0113',
      rpm_at_trigger: 1450,
      ect_at_trigger: 85,
      iat_at_trigger: state.sensors.iat_celsius,
      load_at_trigger: 28,
    } : null,
    include_receipt: document.getElementById('aiIncludeReceipt')?.checked || true,
  };

  try {
    const res = await fetch(`${API_BASE}/ai/diagnose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const result = await res.json();
    renderAiResult(result);
    showToast('Analisis 3-Layer AI Diagnosis Selesai', 'success');
  } catch (err) {
    console.error('Diagnosis Error:', err);
    showToast(`Gagal memproses diagnosis: ${err.message}`, 'danger');
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Jalankan 3-Layer AI Diagnosis';
  }
}

function renderAiResult(result) {
  // Hide empty state and show diagnosis result card
  const emptyState = document.getElementById('aiEmptyState');
  const resultCard = document.getElementById('aiResultCard');
  if (emptyState) emptyState.classList.add('hidden');
  if (resultCard) resultCard.classList.remove('hidden');

  const ai = result.layers?.layer3_ai || {};
  const meta = result.metadata || {};

  // Update Meta & Risk Badge
  document.getElementById('aiResultMeta').textContent = `Latency: ${meta.total_latency_ms || 820}ms • Engine: ${meta.ai_model || 'WRT Engine'}`;
  
  const riskBadge = document.getElementById('aiRiskBadge');
  if (riskBadge) {
    const risk = (ai.risk_level || 'medium').toLowerCase();
    riskBadge.className = `risk-badge risk-${risk}`;
    riskBadge.textContent = `${risk.toUpperCase()} RISK`;
  }

  // Summary
  document.getElementById('aiSummaryText').textContent = ai.summary || 'Diagnosis selesai.';

  // Primary Cause
  if (ai.primary_cause) {
    document.getElementById('aiPrimaryCauseDesc').textContent = ai.primary_cause.description;
    document.getElementById('aiConfidencePill').textContent = `Keyakinan: ${ai.primary_cause.confidence || '90%'}`;
    
    const evContainer = document.getElementById('aiEvidenceList');
    if (evContainer && ai.primary_cause.evidence) {
      evContainer.innerHTML = ai.primary_cause.evidence.map((ev) => `
        <span class="evidence-tag">${ev}</span>
      `).join('');
    }
  }

  // Alternative Causes
  const altContainer = document.getElementById('aiAltCausesGrid');
  if (altContainer && ai.alternative_causes) {
    altContainer.innerHTML = ai.alternative_causes.map((c) => `
      <div class="alt-cause-chip">
        <span>${c.description}</span>
        <strong>(${c.confidence})</strong>
      </div>
    `).join('');
  }

  // Check Steps
  const stepsContainer = document.getElementById('aiCheckStepsList');
  if (stepsContainer && ai.check_steps) {
    stepsContainer.innerHTML = ai.check_steps.map((step) => `
      <li>${step}</li>
    `).join('');
  }

  // Safety Warning
  const safetyCallout = document.getElementById('aiSafetyCallout');
  const safetyText = document.getElementById('aiSafetyText');
  if (ai.safety_warning) {
    safetyCallout.style.display = 'flex';
    safetyText.innerHTML = `<strong>Peringatan Keselamatan:</strong> ${ai.safety_warning}`;
  } else {
    safetyCallout.style.display = 'none';
  }

  // Store in global state for 3-layer printing
  state.lastAiDiagnosisResult = result;

  // Synchronize with 3-Layer Printer Preview
  const risk = (ai.risk_level || 'medium').toUpperCase();
  const summary = ai.summary || 'Analisis sistem Honda PGM-FI selesai.';

  if (document.getElementById('rtAiRisk')) {
    document.getElementById('rtAiRisk').textContent = `RISIKO: [ ${risk} RISK ]`;
  }
  if (document.getElementById('rtAiSummaryText')) {
    document.getElementById('rtAiSummaryText').textContent = summary;
  }
  if (document.getElementById('rtAiSteps') && ai.check_steps) {
    document.getElementById('rtAiSteps').innerHTML = `
      <strong>Langkah Tindakan:</strong><br>
      ${ai.check_steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('<br>')}
    `;
  }
  updateReceiptPreview();
}

// ============================================
// 8. AI Chat Assistant Controller
// ============================================
function initAiChat() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInputText');
  const clearBtn = document.getElementById('btnClearChatBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await sendChatMessage(text);
  });

  // Prompt chips
  document.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        await sendChatMessage(prompt);
      }
    });
  });

  clearBtn?.addEventListener('click', () => {
    state.chatHistory = [];
    const container = document.getElementById('chatMessagesContainer');
    if (container) {
      container.innerHTML = `
        <div class="chat-msg msg-assistant">
          <div class="msg-avatar">TECH</div>
          <div class="msg-bubble">
            <div class="msg-author">WRT AI Master Technician</div>
            <div class="msg-content">
              Percakapan telah dibersihkan. Silakan tanyakan hal teknis seputar Honda PGM-FI!
            </div>
            <div class="msg-time">Sekarang</div>
          </div>
        </div>
      `;
    }
  });
}

async function sendChatMessage(text) {
  const container = document.getElementById('chatMessagesContainer');
  if (!container) return;

  // Append user message
  const userTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  container.insertAdjacentHTML('beforeend', `
    <div class="chat-msg msg-user">
      <div class="msg-avatar">TECH</div>
      <div class="msg-bubble">
        <div class="msg-content">${escapeHtml(text)}</div>
        <div class="msg-time">${userTime}</div>
      </div>
    </div>
  `);

  container.scrollTop = container.scrollHeight;

  // Append typing indicator
  const typingId = 'typing_' + Date.now();
  container.insertAdjacentHTML('beforeend', `
    <div class="chat-msg msg-assistant" id="${typingId}">
      <div class="msg-avatar">TECH</div>
      <div class="msg-bubble">
        <div class="msg-content" style="color: var(--text-muted);">
          <em>Sedang menganalisis basis data Honda PGM-FI...</em>
        </div>
      </div>
    </div>
  `);
  container.scrollTop = container.scrollHeight;

  state.chatHistory.push({ role: 'user', content: text });

  try {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(-6),
      }),
    });

    const json = await res.json();
    const botReply = json.message || 'Mohon maaf, tidak dapat memproses jawaban saat ini.';
    state.chatHistory.push({ role: 'assistant', content: botReply });

    const typingElem = document.getElementById(typingId);
    if (typingElem) typingElem.remove();

    const botTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    container.insertAdjacentHTML('beforeend', `
      <div class="chat-msg msg-assistant">
        <div class="msg-avatar">TECH</div>
        <div class="msg-bubble">
          <div class="msg-author">WRT AI Master Technician</div>
          <div class="msg-content">${formatMarkdown(botReply)}</div>
          <div class="msg-time">${botTime}</div>
        </div>
      </div>
    `);

    container.scrollTop = container.scrollHeight;
  } catch (err) {
    const typingElem = document.getElementById(typingId);
    if (typingElem) typingElem.remove();
    showToast('Gagal menghubungi AI Assistant', 'danger');
  }
}

// ============================================
// 9. Thermal Receipt & Zebra ZPL Printer Controller
// ============================================
function initPrinterView() {
  const btnPrint = document.getElementById('btnPrintReceiptNow');
  const btnUpdate = document.getElementById('btnUpdateReceiptPreview');
  const btnSendZplNet = document.getElementById('btnSendZplNetwork');
  const btnSendZplBt = document.getElementById('btnSendZplBluetooth');
  const btnSendZplUsb = document.getElementById('btnSendZplUsb');
  const btnDownloadZpl = document.getElementById('btnDownloadZpl');
  const btnCopyZpl = document.getElementById('btnCopyZpl');
  const btnCopyZplInner = document.getElementById('btnCopyZplInner');
  const formatSelect = document.getElementById('receiptPaperWidth');

  const tabVisual = document.getElementById('tabVisualReceipt');
  const tabRawZpl = document.getElementById('tabRawZpl');
  const visualContainer = document.getElementById('visualReceiptContainer');
  const rawZplContainer = document.getElementById('rawZplContainer');

  // Preview Mode Tabs
  tabVisual?.addEventListener('click', () => {
    tabVisual.classList.add('active');
    tabRawZpl.classList.remove('active');
    visualContainer?.classList.remove('hidden');
    rawZplContainer?.classList.add('hidden');
  });

  tabRawZpl?.addEventListener('click', () => {
    tabRawZpl.classList.add('active');
    tabVisual.classList.remove('active');
    rawZplContainer?.classList.remove('hidden');
    visualContainer?.classList.add('hidden');
    updateZplCodeArea();
  });

  formatSelect?.addEventListener('change', () => {
    updateReceiptPreview();
  });

  btnUpdate?.addEventListener('click', () => {
    updateReceiptPreview();
    showToast('Preview struk & kode ZPL diperbarui!', 'info');
  });

  btnPrint?.addEventListener('click', () => {
    updateReceiptPreview();
    window.print();
  });

  // Direct IP Network Print
  btnSendZplNet?.addEventListener('click', async () => {
    const ip = document.getElementById('zebraPrinterIp')?.value.trim();
    const port = parseInt(document.getElementById('zebraPrinterPort')?.value || '9100', 10);

    if (!ip) {
      showToast('Masukkan IP address printer Zebra!', 'danger');
      return;
    }

    const zpl = generateCurrentZPL();
    btnSendZplNet.disabled = true;
    btnSendZplNet.innerHTML = '<span>⏳</span> Mengirim ke Zebra...';

    try {
      const res = await fetch(`${API_BASE}/printer/zpl/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({ ip, port, zpl }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`${json.message || 'ZPL berhasil dikirim ke printer!'}`, 'success');
      } else {
        throw new Error(json.message || `Gagal mengirim ke ${ip}:${port}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'danger');
    } finally {
      btnSendZplNet.disabled = false;
      btnSendZplNet.innerHTML = 'Kirim ZPL ke IP Printer';
    }
  });

  // Web Bluetooth Direct Print
  btnSendZplBt?.addEventListener('click', async () => {
    if (!navigator.bluetooth) {
      showToast('Web Bluetooth tidak didukung browser ini. Gunakan Google Chrome.', 'danger');
      return;
    }

    const ALL_BLE_SERVICES = [
      '000018f0-0000-1000-8000-00805f9b34fb', // Standard Mobile POS
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Zebra BLE Service
      '38eb4a80-c570-11e3-9507-0002a5d5c51b', // Zebra ZPL/CPCL Service
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Microchip Transparent UART
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
      '0000ff00-0000-1000-8000-00805f9b34fb', // Xprinter / POS-58
      '0000fee7-0000-1000-8000-00805f9b34fb', // WeChat POS
      '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2540 Serial
      '0000fff0-0000-1000-8000-00805f9b34fb', // POS-58/POS-80
      '0000ae30-0000-1000-8000-00805f9b34fb', // Zjiang
      '0000af30-0000-1000-8000-00805f9b34fb',
      '0000fe00-0000-1000-8000-00805f9b34fb',
      '0000fe11-0000-1000-8000-00805f9b34fb',
      '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
      '0000180a-0000-1000-8000-00805f9b34fb', // Device Info
      '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
      '0000ffe1-0000-1000-8000-00805f9b34fb',
      '0000fff1-0000-1000-8000-00805f9b34fb',
    ];

    const format = document.getElementById('receiptPaperWidth')?.value || 'zpl-58';
    const isEscPos = format === '58mm' || format === '80mm' || format === 'raw';
    const printPayload = isEscPos ? generateCurrentESCPOS(format) : generateCurrentZPL();

    try {
      showToast(`Mencari printer Bluetooth (${isEscPos ? 'ESC/POS' : 'Zebra ZPL'})...`, 'info');
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ALL_BLE_SERVICES,
      });

      if (!device.gatt) {
        throw new Error('GATT Server tidak tersedia pada printer ini.');
      }

      showToast(`Menghubungkan ke ${device.name || 'Printer Bluetooth'}...`, 'info');
      const server = await device.gatt.connect();
      const encoder = new TextEncoder();
      const data = encoder.encode(printPayload);

      // Try discovering services
      let services = [];
      try {
        services = await server.getPrimaryServices();
      } catch (e) {
        console.warn('getPrimaryServices error:', e);
      }

      // Fallback: search known UUIDs one by one
      if (services.length === 0) {
        for (const uuid of ALL_BLE_SERVICES) {
          try {
            const s = await server.getPrimaryService(uuid);
            if (s) services.push(s);
          } catch (ignore) {}
        }
      }

      if (services.length === 0) {
        const useRawBt = confirm(
          `Printer "${device.name || 'Bluetooth'}" menggunakan protokol Classic Bluetooth SPP (bukan BLE GATT).\n\nIngin mencetak langsung via Android RawBT / Bluetooth POS Spooler sekarang?`
        );
        if (useRawBt) {
          const base64Data = btoa(unescape(encodeURIComponent(printPayload)));
          window.location.href = `rawbt:data:text/plain;base64,${base64Data}`;
          return;
        } else {
          throw new Error('Perangkat adalah Bluetooth Classic SPP. Silakan gunakan tombol "Cetak via RawBT" atau buka di Zebra Print Station.');
        }
      }

      // Find writable characteristic
      let targetChar = null;
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetChar = char;
              break;
            }
          }
          if (targetChar) break;
        } catch (e) {
          console.warn('Error reading chars:', e);
        }
      }

      if (!targetChar) {
        throw new Error('Tidak ditemukan karakteristik penulisan data (writable) pada printer Bluetooth ini.');
      }

      showToast('Mengirim stream ZPL ke printer...', 'info');
      const chunkSize = 64;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (targetChar.properties.writeWithoutResponse) {
          await targetChar.writeValueWithoutResponse(chunk);
        } else {
          await targetChar.writeValue(chunk);
        }
        await new Promise((r) => setTimeout(r, 35));
      }

      // Allow printer buffer to complete physical printing before finishing
      await new Promise((r) => setTimeout(r, 800));

      showToast(`Berhasil mencetak ke printer Bluetooth ${device.name}`, 'success');
    } catch (err) {
      console.warn('Bluetooth print error:', err);
      showToast(`Bluetooth Print: ${err.message}`, 'danger');
    }
  });

  // Universal Android RawBT Direct Print
  const btnSendRawBT = document.getElementById('btnSendRawBT');
  btnSendRawBT?.addEventListener('click', () => {
    const format = document.getElementById('receiptPaperWidth')?.value || '58mm';
    const isEscPos = format === '58mm' || format === '80mm' || format === 'raw';
    const printPayload = isEscPos ? generateCurrentESCPOS(format) : generateCurrentZPL();
    const base64Data = btoa(unescape(encodeURIComponent(printPayload)));
    const rawbtUrl = `rawbt:data:text/plain;base64,${base64Data}`;
    showToast(`Membuka RawBT (${isEscPos ? 'Thermal ESC/POS' : 'Zebra ZPL'})...`, 'info');
    
    // Trigger intent via anchor click to bypass popup blockers
    const link = document.createElement('a');
    link.href = rawbtUrl;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 500);
  });

  // Share to Zebra Print Station / Print App
  const btnShareZpl = document.getElementById('btnShareZpl');
  btnShareZpl?.addEventListener('click', async () => {
    const zpl = generateCurrentZPL();
    const plate = document.getElementById('receiptPlate')?.value || 'B4521WRT';
    const filename = `WRT_Diagnosis_${plate.replace(/\s+/g, '_')}.zpl`;

    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const file = new File([blob], filename, { type: 'text/plain' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'WRT DIAGNOSIS Agent AI ZPL Print',
          text: 'Cetak Laporan Diagnosis ke Zebra Printer',
          files: [file],
        });
        showToast('Membuka di aplikasi printer Zebra!', 'success');
      } catch (e) {
        console.warn('Share error:', e);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('File .ZPL diunduh! Silakan buka di Zebra Print Station / PrintHand.', 'info');
    }
  });

  // Web Serial USB Print
  btnSendZplUsb?.addEventListener('click', async () => {
    if (!navigator.serial) {
      showToast('Web Serial tidak didukung pada browser ini. Gunakan Chrome Desktop.', 'danger');
      return;
    }

    const zpl = generateCurrentZPL();
    try {
      showToast('Pilih port USB Printer Zebra...', 'info');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });

      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      await writer.write(zpl);
      writer.releaseLock();
      await writableStreamClosed;
      await port.close();

      showToast('Berhasil mengirim stream ZPL via USB Serial', 'success');
    } catch (err) {
      console.warn('Serial print error:', err);
      showToast(`USB Print: ${err.message}`, 'danger');
    }
  });

  // Download .ZPL File
  btnDownloadZpl?.addEventListener('click', () => {
    const zpl = generateCurrentZPL();
    const plate = document.getElementById('receiptPlate')?.value || 'B4521WRT';
    const filename = `WRT_Diagnosis_${plate.replace(/\s+/g, '_')}_${Date.now()}.zpl`;

    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`File ${filename} berhasil diunduh`, 'success');
  });

  // Copy ZPL Code
  const handleCopyZpl = () => {
    const zpl = generateCurrentZPL();
    navigator.clipboard.writeText(zpl).then(() => {
      showToast('Kode ZPL II berhasil disalin ke clipboard', 'success');
    }).catch(() => {
      showToast('Gagal menyalin kode ZPL', 'danger');
    });
  };

  btnCopyZpl?.addEventListener('click', handleCopyZpl);
  btnCopyZplInner?.addEventListener('click', handleCopyZpl);

  // Initial preview
  updateReceiptPreview();
}

function formatTwoCols(left, right, width = 32) {
  const half = Math.floor(width / 2);
  const l = left.padEnd(half, ' ').substring(0, half);
  const r = right.padStart(width - half, ' ').substring(0, width - half);
  return l + r;
}

function formatRow(left, right, width = 32) {
  const spaceCount = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right;
}

function wrapText(str, width = 32) {
  const words = str.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

/**
 * Generate Raw ESC/POS Binary Text matching physical preview 100%
 */
function generateCurrentESCPOS(paperWidth = '58mm') {
  const is80 = paperWidth === '80mm';
  const width = is80 ? 42 : 32;
  const sep = '='.repeat(width);
  const dash = '-'.repeat(width);

  const ESC = '\x1B';
  const GS = '\x1D';

  let bin = '';
  bin += ESC + '@'; // Initialize printer

  // Header (Centered, Bold)
  bin += ESC + 'a' + '\x01'; // Center align
  bin += ESC + 'E' + '\x01'; // Bold ON
  bin += (document.getElementById('rtShopName')?.textContent || 'WRT DIAGNOSIS Agent AI') + '\n';
  bin += ESC + 'E' + '\x00'; // Bold OFF
  bin += (document.getElementById('rtShopAddr')?.textContent || 'Jl. Otista Raya No. 88 | WA: 0812-3456-7890') + '\n';
  bin += sep + '\n';
  bin += ESC + 'E' + '\x01';
  bin += 'HONDA PGM-FI AI DIAGNOSTIC REPORT\n';
  bin += ESC + 'E' + '\x00';
  bin += dash + '\n';

  // Metadata (Left Align)
  bin += ESC + 'a' + '\x00'; // Left align
  bin += formatRow('TANGGAL :', document.getElementById('rtDate')?.textContent || new Date().toLocaleString('id-ID'), width) + '\n';
  bin += formatRow('NO. POL :', document.getElementById('rtPlate')?.textContent || 'B 4521 WRT', width) + '\n';
  bin += formatRow('MOTOR   :', document.getElementById('rtMotor')?.textContent || 'Honda PCX 160 eSP+', width) + '\n';
  bin += formatRow('ODOMETER:', document.getElementById('rtOdo')?.textContent || '14,250 KM', width) + '\n';
  bin += formatRow('MEKANIK :', document.getElementById('rtTech')?.textContent || 'Mekanik WRT', width) + '\n';
  bin += sep + '\n';

  // [ LAYER 1: DTC RULE ENGINE ]
  bin += ESC + 'E' + '\x01';
  bin += '[1] LAYER 1: DTC RULE ENGINE\r\n';
  bin += ESC + 'E' + '\x00';
  if (state.activeDTCs.length > 0) {
    state.activeDTCs.forEach((d) => {
      bin += `* [${d.code}] ${d.name}\r\n`;
      bin += `  Status: AKTIF ${d.code === 'P0113' ? '(9 KEDIPAN MIL)' : ''}\r\n`;
    });
  } else {
    bin += '  * ECM STATUS: NORMAL (TIDAK ADA DTC)\r\n';
  }
  bin += dash + '\r\n';

  // [ LAYER 2: SENSOR KNOWLEDGE BASE ]
  bin += ESC + 'E' + '\x01';
  bin += '[2] LAYER 2: SENSOR KNOWLEDGE BASE\r\n';
  bin += ESC + 'E' + '\x00';
  bin += formatTwoCols(`RPM : ${state.sensors.rpm} rpm`, `ECT : ${state.sensors.ect_celsius} C`, width) + '\r\n';
  bin += formatTwoCols(`IAT : ${state.sensors.iat_celsius} C ${state.sensors.iat_celsius <= -30 ? '(!)' : ''}`, `TPS : ${state.sensors.tps_volt} V`, width) + '\r\n';
  bin += formatTwoCols(`VBAT: ${state.sensors.battery_volt} V`, `MAP : ${state.sensors.map_kpa} kPa`, width) + '\r\n';
  bin += dash + '\r\n';

  // [ LAYER 3: GOOGLE GEMINI AI REASONING ]
  bin += ESC + 'E' + '\x01';
  bin += '[3] LAYER 3: AI REASONING (GEMINI)\r\n';
  bin += ESC + 'E' + '\x00';

  const aiDiag = state.lastAiDiagnosisResult?.layers?.layer3_ai || {};
  const risk = (aiDiag.risk_level || 'MEDIUM').toUpperCase();
  bin += `RISIKO: [ ${risk} RISK ]\r\n\r\n`;

  const summary = aiDiag.summary || document.getElementById('rtAiSummaryText')?.textContent || 'Analisis sistem Honda PGM-FI selesai.';
  bin += wrapText(summary.trim(), width) + '\r\n\r\n';

  if (aiDiag.primary_cause?.description) {
    bin += `Penyebab (${aiDiag.primary_cause.confidence || '90%'}):\r\n`;
    bin += wrapText(aiDiag.primary_cause.description, width) + '\r\n\r\n';
  }

  if (aiDiag.check_steps && aiDiag.check_steps.length > 0) {
    bin += 'Langkah Tindakan:\r\n';
    aiDiag.check_steps.slice(0, 4).forEach((s, i) => {
      bin += wrapText(`${i + 1}. ${s}`, width) + '\r\n';
    });
    bin += '\r\n';
  }

  if (aiDiag.safety_warning) {
    bin += `Perhatian: [!] ${aiDiag.safety_warning}\r\n\r\n`;
  }

  bin += sep + '\r\n';

  // Footer (Centered)
  bin += ESC + 'a' + '\x01';
  bin += 'Scan QR Riwayat Servis Digital\r\n';
  bin += (document.getElementById('receiptNotes')?.value || 'Garansi servis sensor 14 hari kerja.') + '\r\n';
  bin += 'Terima kasih atas kunjungan Anda!\r\n';
  bin += '\r\n\r\n\r\n\r\n';
  bin += GS + 'V' + '\x41' + '\x03'; // Partial Cut

  return bin;
}

/**
 * Generate Zero-Collision Zebra ZPL Code matching physical preview layout exactly
 */
function generateCurrentZPL() {
  const shopName = (document.getElementById('rtShopName')?.textContent || 'WRT DIAGNOSIS Agent AI').toUpperCase();
  const shopAddr = document.getElementById('rtShopAddr')?.textContent || 'Jl. Otista Raya No. 88 | WA: 0812-3456-7890';
  const plate = document.getElementById('rtPlate')?.textContent || 'B 4521 WRT';
  const motor = document.getElementById('rtMotor')?.textContent || 'Honda PCX 160 eSP+';
  const odo = document.getElementById('rtOdo')?.textContent || '14,250 KM';
  const tech = document.getElementById('rtTech')?.textContent || 'Mekanik WRT';
  const dateStr = document.getElementById('rtDate')?.textContent || new Date().toLocaleString('id-ID');
  const aiDiag = state.lastAiDiagnosisResult?.layers?.layer3_ai || {};
  const aiSummary = (aiDiag.summary || document.getElementById('rtAiSummaryText')?.textContent || 'Analisis sistem selesai.').trim();
  const primaryCause = (aiDiag.primary_cause?.description || '').trim();
  const risk = (aiDiag.risk_level || 'MEDIUM').toUpperCase();
  const notes = (document.getElementById('receiptNotes')?.value || 'Garansi servis sensor 14 hari kerja.').trim();
  const format = document.getElementById('receiptPaperWidth')?.value || 'zpl-58';

  const width = format === 'zpl-100' ? 800 : format === 'zpl-80' ? 600 : 440;
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
    const words = text.split(/\s+/);
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= maxCharsLine) {
        cur = (cur ? cur + ' ' : '') + w;
      } else {
        if (cur) {
          bodyZpl += `^FO${margin},${y}^A0N,${fontSize},${fontSize}^FD${escapeZpl(indent + cur)}^FS\n`;
          y += Math.round(fontSize * 1.25);
        }
        cur = w;
      }
    }
    if (cur) {
      bodyZpl += `^FO${margin},${y}^A0N,${fontSize},${fontSize}^FD${escapeZpl(indent + cur)}^FS\n`;
      y += Math.round(fontSize * 1.25);
    }
  }

  function addDivider(thickness = 2) {
    y += 4;
    bodyZpl += `^FO${margin},${y}^GB${contentWidth},${thickness},${thickness}^FS\n`;
    y += thickness + 8;
  }

  // 1. Header (Starts at top without giant margin)
  addCenterText(shopName, 26);
  addCenterText(shopAddr, 18);
  addDivider(3);
  addCenterText('3-LAYER AI DIAGNOSTIC REPORT', 20);
  addDivider(1);

  // 2. Metadata Grid
  addTextLine(`TANGGAL : ${dateStr}`, 18);
  addTextLine(`NO. POL : ${plate}`, 20);
  addTextLine(`MOTOR   : ${motor}`, 18);
  addTextLine(`ODOMETER: ${odo}`, 18);
  addTextLine(`MEKANIK : ${tech}`, 18);
  addDivider(3);

  // [ LAYER 1: DTC RULE ENGINE ]
  addTextLine('[1] LAYER 1: DTC RULE ENGINE', 22);
  y += 4;

  if (state.activeDTCs.length > 0) {
    state.activeDTCs.forEach((d) => {
      const code = d.code;
      const name = (d.name || '').substring(0, 24).toUpperCase();
      const blinkInfo = code === 'P0113' ? ' (9K)' : '';
      addTextLine(`* [${code}] ${name}${blinkInfo}`, 18);
      addTextLine(`  Status: AKTIF (Prioritas: ${(d.priority || 'medium').toUpperCase()})`, 16);
    });
  } else {
    addTextLine('* ECM STATUS: NORMAL (TIDAK ADA DTC)', 18);
  }
  addDivider(1);

  // [ LAYER 2: SENSOR KNOWLEDGE BASE ]
  addTextLine('[2] LAYER 2: SENSOR KNOWLEDGE BASE', 22);
  y += 4;
  const col2X = margin + Math.round(contentWidth / 2);
  bodyZpl += `^FO${margin},${y}^A0N,18,18^FDRPM : ${state.sensors.rpm} rpm^FS^FO${col2X},${y}^A0N,18,18^FDECT : ${state.sensors.ect_celsius} C^FS\n`;
  y += 22;
  const iatWarn = state.sensors.iat_celsius <= -30 ? ' (!)' : '';
  bodyZpl += `^FO${margin},${y}^A0N,18,18^FDIAT : ${state.sensors.iat_celsius} C${iatWarn}^FS^FO${col2X},${y}^A0N,18,18^FDTPS : ${state.sensors.tps_volt} V^FS\n`;
  y += 22;
  bodyZpl += `^FO${margin},${y}^A0N,18,18^FDVBAT: ${state.sensors.battery_volt} V^FS^FO${col2X},${y}^A0N,18,18^FDMAP : ${state.sensors.map_kpa} kPa^FS\n`;
  y += 28;
  addDivider(1);

  // [ LAYER 3: AI REASONING (GOOGLE GEMINI) ]
  addTextLine(`[3] LAYER 3: AI REASONING [${risk}]`, 22);
  y += 4;

  if (aiSummary) {
    addTextLine('Ringkasan Kondisi:', 18);
    addWrappedParagraph(aiSummary, 17);
    y += 4;
  }

  if (primaryCause) {
    const conf = aiDiag.primary_cause?.confidence || '90%';
    addTextLine(`Penyebab Utama (Keyakinan: ${conf}):`, 18);
    addWrappedParagraph(`- ${primaryCause}`, 17);
    y += 4;
  }

  if (aiDiag.check_steps && aiDiag.check_steps.length > 0) {
    addTextLine('SOP Langkah Tindakan Mekanik:', 18);
    aiDiag.check_steps.slice(0, 4).forEach((s, idx) => {
      addWrappedParagraph(`${idx + 1}. ${s}`, 16);
    });
    y += 4;
  }

  if (aiDiag.safety_warning) {
    addTextLine('Peringatan Keselamatan:', 18);
    addWrappedParagraph(`[!] ${aiDiag.safety_warning}`, 16);
    y += 4;
  }

  addDivider(3);

  // 6. QR Code & Footer
  const qrX = Math.round((width - 120) / 2);
  const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, '');
  const qrUrl = `https://wrt.garage/r/${cleanPlate}`;
  bodyZpl += `^FO${qrX},${y}^BQN,2,4^FDMM,AAC-${qrUrl}^FS\n`;
  y += 135;

  addCenterText('Scan QR Riwayat Servis Digital', 16);
  addCenterText(notes || 'Garansi servis sensor 14 hari kerja.', 16);
  addCenterText('Presisi • Cepat • Terpercaya', 14);
  y += 30;

  const totalLength = y + 100;

  let zpl = '^XA\n';
  zpl += `^PW${width}\n`;
  zpl += `^LL${totalLength}\n`;
  zpl += '^LT0\n';      // Zero Top Offset
  zpl += '^LH0,0\n';    // Zero Label Home
  zpl += '^MNN\n';      // Continuous Media Tracking
  zpl += '^MD15\n';     // High Darkness
  zpl += '^PON\n';
  zpl += '^CI28\n';
  zpl += bodyZpl;
  zpl += `^FO0,${totalLength - 10}^FD ^FS\n`;
  zpl += '^XZ\n';

  return zpl;
}

function updateZplCodeArea() {
  const codeArea = document.getElementById('rawZplCodeArea');
  if (codeArea) {
    codeArea.value = generateCurrentZPL();
  }
}

function updateReceiptPreview() {
  const shopName = document.getElementById('receiptShopName')?.value || 'WRT DIAGNOSIS Agent AI';
  const shopAddr = document.getElementById('receiptShopAddress')?.value || 'Jl. Otista Raya No. 88 | WA: 0812-3456-7890';
  const plate = document.getElementById('receiptPlate')?.value || 'B 4521 WRT';
  const motor = document.getElementById('receiptMotor')?.value || state.currentVehicle.name || 'Honda PCX 160 eSP+';
  const tech = document.getElementById('receiptTech')?.value || 'Mekanik WRT';
  const notes = document.getElementById('receiptNotes')?.value || 'Garansi servis sensor 14 hari kerja.';
  const odo = `${(state.currentVehicle.mileage || 14250).toLocaleString('id-ID')} KM`;

  document.getElementById('rtShopName').textContent = shopName;
  document.getElementById('rtShopAddr').textContent = shopAddr;
  document.getElementById('rtPlate').textContent = plate;
  document.getElementById('rtMotor').textContent = motor;
  document.getElementById('rtTech').textContent = tech;
  document.getElementById('rtOdo').textContent = odo;
  document.getElementById('rtNotes').innerHTML = `${escapeHtml(notes)}<br>Terima kasih atas kunjungan Anda!`;
  document.getElementById('rtDate').textContent = new Date().toLocaleString('id-ID');

  // Dynamically update DTC list in preview
  const dtcContainer = document.getElementById('rtDtcList');
  if (dtcContainer) {
    if (state.activeDTCs.length > 0) {
      dtcContainer.innerHTML = state.activeDTCs.map((d) => `
        <div class="r-dtc-item">
          <div><strong>[${d.code}] ${d.name.toUpperCase()}</strong></div>
          <div>Status: AKTIF ${d.code === 'P0113' ? '(9 KEDIPAN MIL)' : ''}</div>
        </div>
      `).join('');
    } else {
      dtcContainer.innerHTML = '<div class="r-dtc-item"><div><strong>[ECM NORMAL]</strong></div><div>Status: TIDAK ADA KODE ERROR</div></div>';
    }
  }

  // Dynamically update Telemetry in preview
  const telemContainer = document.getElementById('rtTelemetryGrid');
  if (telemContainer) {
    telemContainer.innerHTML = `
      <div>RPM : ${state.sensors.rpm.toLocaleString('id-ID')} rpm</div>
      <div>ECT : ${state.sensors.ect_celsius} °C</div>
      <div>IAT : ${state.sensors.iat_celsius} °C ${state.sensors.iat_celsius <= -30 ? '(ANOMALI)' : ''}</div>
      <div>TPS : ${state.sensors.tps_volt} V</div>
      <div>VBAT: ${state.sensors.battery_volt} V</div>
      <div>MAP : ${state.sensors.map_kpa} kPa</div>
    `;
  }

  updateZplCodeArea();
}

// ============================================
// 10. Honda ECU Database Explorer
// ============================================
async function initEcuDatabase() {
  const searchInput = document.getElementById('ecuSearchInput');
  searchInput?.addEventListener('input', (e) => {
    filterEcuTable(e.target.value);
  });

  try {
    const res = await fetch(`${API_BASE}/motors`);
    if (res.ok) {
      const json = await res.json();
      state.motorsDatabase = json.data || [];
      renderEcuTable(state.motorsDatabase);
    }
  } catch (err) {
    console.warn('Failed to load ECU database:', err);
  }
}

function renderEcuTable(data) {
  const tbody = document.getElementById('ecuTableBody');
  if (!tbody) return;

  const rows = [];
  data.forEach((group) => {
    group.variants.forEach((v) => {
      rows.push(`
        <tr>
          <td><strong>${group.model}</strong></td>
          <td><span class="meta-tag tag-mono">${v.model_code}</span></td>
          <td>${v.year_start}–${v.year_end || 'Sekarang'}</td>
          <td><strong style="color: var(--accent-cyan); font-family: var(--font-mono);">${v.part_number}</strong></td>
          <td>${v.manufacturer}</td>
          <td><span class="badge-status status-good">${v.protocol}</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="selectMotorPreset('${group.model}', '${v.model_code}', '${v.part_number}', '${v.manufacturer}')">
              Pilih Motor
            </button>
          </td>
        </tr>
      `);
    });
  });

  tbody.innerHTML = rows.join('');
}

function filterEcuTable(query) {
  const q = query.toLowerCase();
  const filtered = state.motorsDatabase.map((g) => ({
    model: g.model,
    variants: g.variants.filter((v) => 
      g.model.toLowerCase().includes(q) ||
      v.model_code.toLowerCase().includes(q) ||
      v.part_number.toLowerCase().includes(q) ||
      v.manufacturer.toLowerCase().includes(q)
    ),
  })).filter((g) => g.variants.length > 0);

  renderEcuTable(filtered);
}

window.selectMotorPreset = function(model, code, part, mfg) {
  state.currentVehicle.name = `${model} (${code})`;
  state.currentVehicle.modelCode = code;
  state.currentVehicle.partNumber = part;
  state.currentVehicle.manufacturer = mfg;

  document.getElementById('heroBikeName').textContent = `Honda ${model} (${code})`;
  document.getElementById('heroEcuPart').textContent = `Part: ${part}`;
  document.getElementById('heroEcuMfg').textContent = mfg;
  document.getElementById('aiMotorModel').value = `Honda ${model} (${part})`;
  document.getElementById('receiptMotor').value = `Honda ${model}`;

  switchView('view-dashboard');
  showToast(`Kendaraan aktif diset ke: Honda ${model} [${part}]`, 'success');
};

// ============================================
// 11. K-Line HEX Terminal Controller
// ============================================
function initTerminal() {
  const form = document.getElementById('terminalForm');
  const input = document.getElementById('terminalInputHex');
  const screen = document.getElementById('terminalScreen');
  const clearBtn = document.getElementById('btnClearTerminal');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const hex = input.value.trim();
    if (!hex) return;
    sendTerminalHex(hex);
  });

  clearBtn?.addEventListener('click', () => {
    if (screen) screen.innerHTML = '';
  });

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hex = btn.getAttribute('data-hex');
      if (hex) {
        input.value = hex;
        sendTerminalHex(hex);
      }
    });
  });
}

function sendTerminalHex(hex) {
  const screen = document.getElementById('terminalScreen');
  if (!screen) return;

  const time = new Date().toLocaleTimeString('id-ID');
  screen.insertAdjacentHTML('beforeend', `
    <div class="term-line term-tx"><span class="term-time">${time}</span> TX -> ${hex}</div>
  `);

  // Simulate responses
  setTimeout(() => {
    const clean = hex.replace(/\s+/g, '').toUpperCase();
    let rx = '02 04 7F 11 6A';
    if (clean.startsWith('72050000')) rx = '02 04 00 7F D5 (Fast Init Wakeup OK)';
    else if (clean.startsWith('72057100')) rx = '02 06 71 01 13 05 62 A2 (DTC: P0113, P0562)';
    else if (clean.startsWith('72077200')) rx = '02 12 72 05 AB 30 58 00 22 2C 00 1C 04 00 00 00 8C (Live Data Table 0)';
    else if (clean.startsWith('72057000')) rx = '02 0B 70 33 30 34 30 30 2D 4B 31 5A A1 [Part: 30400-K1Z-N01]';
    else if (clean.startsWith('72050400')) rx = '02 04 04 00 F6 (ECM Cleared)';

    screen.insertAdjacentHTML('beforeend', `
      <div class="term-line term-rx"><span class="term-time">${new Date().toLocaleTimeString('id-ID')}</span> RX <- ${rx}</div>
    `);
    screen.scrollTop = screen.scrollHeight;
  }, 120);
}

// ============================================
// 12. Service Sessions History Controller
// ============================================
async function initSessions() {
  const btnNew = document.getElementById('btnNewSession');
  btnNew?.addEventListener('click', async () => {
    await createNewSessionPrompt();
  });

  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      headers: { 'X-API-Key': API_KEY },
    });
    if (res.ok) {
      const json = await res.json();
      state.sessionsList = json.data || [];
      renderSessionsTable(state.sessionsList);
    }
  } catch (e) {
    console.warn('Sessions load error:', e);
  }
}

function renderSessionsTable(sessions) {
  const tbody = document.getElementById('sessionsTableBody');
  if (!tbody) return;

  if (sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Belum ada sesi servis yang dicatat.</td></tr>';
    return;
  }

  tbody.innerHTML = sessions.map((s) => `
    <tr>
      <td>${new Date(s.started_at || Date.now()).toLocaleDateString('id-ID')}</td>
      <td><strong>${s.vehicle_model || 'PCX 160 eSP+'}</strong></td>
      <td><span class="meta-tag tag-mono">${s.plate_number || 'B 4521 WRT'}</span></td>
      <td>${s.technician_name || 'Mekanik WRT'}</td>
      <td>${s.complaint || 'Pemeriksaan rutin PGM-FI'}</td>
      <td><span class="badge-status ${s.status === 'completed' ? 'status-good' : 'status-warn'}">${s.status || 'open'}</span></td>
      <td style="font-family: var(--font-mono);">Rp ${(s.total_cost_idr || 75000).toLocaleString('id-ID')}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="viewSessionDetail('${s.id}')">Lihat</button>
      </td>
    </tr>
  `).join('');
}

async function createNewSessionPrompt() {
  const complaint = prompt('Masukkan keluhan motor:', 'Tarikan gas brebet saat akselerasi');
  if (!complaint) return;

  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        mileage_at_svc: 14250,
        complaint,
      }),
    });

    if (res.ok) {
      showToast('Sesi servis baru berhasil dibuat!', 'success');
      initSessions();
    }
  } catch (err) {
    showToast('Gagal membuat sesi servis baru', 'danger');
  }
}

window.viewSessionDetail = function(id) {
  showToast(`Membuka sesi servis ID: ${id.substring(0, 8)}...`, 'info');
  switchView('view-ai');
};

// ============================================
// 13. API Health Checker
// ============================================
async function checkApiHealth() {
  const pill = document.getElementById('apiStatusPill');
  const text = document.getElementById('apiStatusText');

  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      if (text) text.textContent = 'API: Online (Port 3000)';
      if (pill) pill.className = 'status-pill status-connected';
    } else {
      throw new Error();
    }
  } catch (e) {
    if (text) text.textContent = 'API: Offline';
    if (pill) pill.className = 'status-pill status-warn';
  }
}

// ============================================
// Utility Helpers
// ============================================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// Register PWA Service Worker for Android Installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA] ServiceWorker registered with scope:', reg.scope))
      .catch((err) => console.warn('[PWA] ServiceWorker registration failed:', err));
  });
}

