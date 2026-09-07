// ============================================
// WRT Garage — Session Routes
// ============================================
const express = require('express');
const router = express.Router();
const sessionService = require('../services/session.service');

/**
 * POST /api/sessions — Create new service session
 */
router.post('/', async (req, res) => {
  try {
    const session = await sessionService.createSession(req.body);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('[Sessions] Create error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /api/sessions — List sessions (with filters)
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await sessionService.listSessions(req.query);
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[Sessions] List error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/sessions/:id — Get session detail
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await sessionService.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('[Sessions] Get error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * PATCH /api/sessions/:id — Update session
 */
router.patch('/:id', async (req, res) => {
  try {
    const session = await sessionService.updateSession(req.params.id, req.body);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or no fields to update' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('[Sessions] Update error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

module.exports = router;
