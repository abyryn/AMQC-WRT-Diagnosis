// ============================================
// WRT Garage — Feedback Routes
// POST /api/feedback — Submit diagnosis feedback
// ============================================
const express = require('express');
const router = express.Router();
const db = require('../database/db');

/**
 * POST /api/feedback
 * Submit feedback for an AI diagnosis session
 */
router.post('/', async (req, res) => {
  try {
    const { ai_session_id, score, note } = req.body;

    if (!ai_session_id || !score) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "ai_session_id" dan "score" (1-5) wajib diisi.',
      });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Score harus antara 1-5.',
      });
    }

    const result = await db.query(
      `UPDATE ai_sessions SET feedback_score = $1, feedback_note = $2 WHERE id = $3 RETURNING id, feedback_score`,
      [score, note || null, ai_session_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'AI session not found' });
    }

    res.json({
      success: true,
      message: 'Terima kasih atas feedback Anda!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

module.exports = router;
