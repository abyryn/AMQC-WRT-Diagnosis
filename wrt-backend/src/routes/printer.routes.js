// ============================================
// WRT Garage — Printer Routes (Zebra ZPL & ESC/POS)
// ============================================
const express = require('express');
const router = express.Router();
const receiptService = require('../services/receipt.service');

/**
 * POST /api/printer/zpl — Generate ZPL II string
 */
router.post('/zpl', (req, res) => {
  try {
    const data = req.body;
    const options = {
      paperWidth: data.paperWidth || '58mm',
      widthDots: data.widthDots || (data.paperWidth === '80mm' ? 600 : data.paperWidth === '100mm' ? 800 : 440),
    };

    const zplString = receiptService.generateReceiptZPL(data, options);
    res.json({
      success: true,
      format: 'ZPL II',
      paperWidth: options.paperWidth,
      zpl: zplString,
    });
  } catch (error) {
    console.error('[Printer Route] ZPL generation error:', error);
    res.status(500).json({ error: 'Gagal membuat kode ZPL' });
  }
});

/**
 * POST /api/printer/zpl/send — Send raw ZPL to network Zebra printer (Port 9100)
 */
router.post('/zpl/send', async (req, res) => {
  try {
    const { ip, port, zpl, receiptData } = req.body;

    if (!ip) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'IP Address printer wajib diisi (contoh: 192.168.1.100).',
      });
    }

    let zplToSend = zpl;
    if (!zplToSend && receiptData) {
      zplToSend = receiptService.generateReceiptZPL(receiptData);
    }

    if (!zplToSend) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Konten ZPL atau receiptData wajib disediakan.',
      });
    }

    const result = await receiptService.sendZplToNetworkPrinter(ip, port || 9100, zplToSend);
    res.json(result);
  } catch (error) {
    console.error('[Printer Route] Direct network print error:', error);
    res.status(500).json({
      error: 'Network Print Error',
      message: error.message || 'Gagal mengirim ZPL ke printer jaringan.',
    });
  }
});

/**
 * POST /api/printer/3layer — Generate full 3-layer report for print (ESC/POS, ZPL, and HTML)
 */
router.post('/3layer', (req, res) => {
  try {
    const { sessionData, diagnosisResult, vehicleData, paperWidth } = req.body;

    const receiptData = receiptService.generateReceiptData(
      sessionData || {},
      diagnosisResult || {},
      vehicleData || {}
    );

    const text58mm = receiptService.generateReceiptText58mm(receiptData);
    const text80mm = receiptService.generateReceiptText80mm(receiptData);
    const zplString = receiptService.generateReceiptZPL(receiptData, { paperWidth: paperWidth || '58mm' });
    const htmlReport = receiptService.generateReceiptHTML(receiptData);

    res.json({
      success: true,
      report_type: '3-LAYER HONDA PGM-FI AI REPORT',
      receipt_data: receiptData,
      formats: {
        escpos_58mm: text58mm,
        escpos_80mm: text80mm,
        zpl_ii: zplString,
        html_report: htmlReport,
      },
    });
  } catch (error) {
    console.error('[Printer Route] 3-Layer print format error:', error);
    res.status(500).json({ error: 'Gagal membuat format cetak 3-layer diagnosis' });
  }
});

/**
 * GET /api/printer/3layer/html — Render printable HTML view
 */
router.get('/3layer/html', (req, res) => {
  try {
    // Generate sample/demo 3-layer receipt HTML if called directly
    const sampleReceipt = receiptService.generateReceiptData(
      { technician_name: 'Mekanik WRT', shop_name: 'WRT DIAGNOSIS AGENT AI' },
      {
        layers: {
          layer1_dtc: {
            details: [{ code: 'P0113', name: 'Intake Air Temperature High', sensor: 'IAT', priority: 'medium', mil_blinks: 9 }],
          },
          layer2_sensors: {
            anomalies: [{ sensor: 'IAT', name: 'Intake Air Temp', value: '-40 °C', status: 'fault', detail: 'Sirkuit terbuka / kabel terlepas' }],
          },
          layer3_ai: {
            risk_level: 'MEDIUM',
            summary: 'Malfungsi sensor IAT terbaca -40°C mengindikasikan sirkuit terbuka pada soket filter udara.',
            primary_cause: { description: 'Soket IAT terlepas atau kabel putus di dekat soket', confidence: '92%' },
            check_steps: ['Periksa soket fisik sensor IAT di filter udara.', 'Ukur tegangan referensi 5.0V kabel Abu-abu/Biru.', 'Lakukan Reset ECM & Reset TP.'],
            safety_warning: 'Pastikan kunci kontak OFF sebelum melepas soket sensor.',
          },
        },
        metadata: { ai_model: 'Google Gemini 3.5 Flash', total_latency_ms: 780 },
      },
      { plate_number: 'B 4521 WRT', model: 'Honda PCX 160 eSP+', mileage_km: 14250, part_number: '30400-K1Z-N01' }
    );

    const html = receiptService.generateReceiptHTML(sampleReceipt);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).send('Error rendering HTML report');
  }
});

module.exports = router;
