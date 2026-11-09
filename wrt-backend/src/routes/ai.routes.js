// ============================================
// WRT Garage — AI Routes
// POST /api/ai/diagnose — Full 3-layer diagnosis
// POST /api/ai/chat     — Free-form AI chat
// ============================================
const express = require('express');
const router = express.Router();
const diagnosisService = require('../services/diagnosis.service');
const geminiService = require('../services/gemini.service');
const receiptService = require('../services/receipt.service');
const { aiLimiter } = require('../middleware/rateLimit.middleware');

// Apply stricter rate limit to AI endpoints
router.use(aiLimiter);

/**
 * POST /api/ai/diagnose
 * Full 3-layer AI diagnosis (DTC + Live Data + Freeze Frame + Context)
 */
router.post('/diagnose', async (req, res) => {
  const tRouteStart = performance.now();
  console.log(`[AI Route:HTTP] 📥 POST /api/ai/diagnose diterima pada ${new Date().toLocaleTimeString('id-ID')}`);
  try {
    const payload = req.body;

    // Validate required fields
    if (!payload.dtc && !payload.live_data) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Minimal harus ada data DTC atau Live Data untuk diagnosis.',
      });
    }

    // Run 3-layer diagnosis
    const result = await diagnosisService.runDiagnosis(payload);

    // Optionally save to database
    if (payload.session_id) {
      await diagnosisService.saveDiagnosisSession(payload.session_id, payload, result);
    }

    // Generate receipt data if requested
    if (payload.include_receipt) {
      const tReceiptStart = performance.now();
      result.receipt = receiptService.generateReceiptData(
        { id: payload.session_id || 'temp', technician_name: payload.technician || 'Mekanik' },
        result,
        payload.motor
      );
      result.receipt_text_58mm = receiptService.generateReceiptText58mm(result.receipt);
      const tReceiptDuration = performance.now() - tReceiptStart;
      console.log(`[AI Route:Receipt] 🧾 Struk diagnosis & ESC/POS 58mm dibuat dalam ${tReceiptDuration.toFixed(2)}ms`);
    }

    const tRouteDuration = performance.now() - tRouteStart;
    console.log(`[AI Route:HTTP] 📤 Response /api/ai/diagnose selesai diproses & dikirim dalam ${tRouteDuration.toFixed(2)}ms\n`);
    res.json(result);
  } catch (error) {
    const tRouteDuration = performance.now() - tRouteStart;
    console.error(`[AI Route:HTTP] ❌ Diagnosis error (${tRouteDuration.toFixed(2)}ms):`, error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan saat memproses diagnosis AI.',
    });
  }
});

/**
 * POST /api/ai/chat
 * Free-form chat with AI about Honda PGM-FI
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "message" wajib diisi.',
      });
    }

    const aiProvider = diagnosisService.getAiProvider();
    const result = await aiProvider.chat(message, history || []);
    res.json({
      ...result,
      message: result.reply,
      reply: result.reply,
    });
  } catch (error) {
    console.error('[AI Route] Chat error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan saat memproses chat AI.',
    });
  }
});

module.exports = router;
