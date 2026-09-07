// ============================================
// WRT Garage — Backend API Server
// Honda PGM-FI AI Diagnostic Tool v2.0
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./database/db');
const authMiddleware = require('./middleware/auth.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');

// Import routes
const aiRoutes = require('./routes/ai.routes');
const dtcRoutes = require('./routes/dtc.routes');
const motorsRoutes = require('./routes/motors.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const printerRoutes = require('./routes/printer.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware Stack
// ============================================
app.use(helmet());
app.use(cors({
  origin: '*', // In production, restrict to your mobile app's domain
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(apiLimiter);

// ============================================
// Public Routes (no auth required)
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WRT Garage Backend API',
    version: '2.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// DTC database is public (lookup reference)
app.use('/api/dtc-db', dtcRoutes);

// Motors reference is public
app.use('/api/motors', motorsRoutes);

// Printer endpoints (ZPL generation & IP printing)
app.use('/api/printer', printerRoutes);

// ============================================
// Protected Routes (auth required)
// ============================================
app.use(authMiddleware);

app.use('/api/ai', aiRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/feedback', feedbackRoutes);

// ============================================
// Error Handling
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} tidak ditemukan.`,
    available_endpoints: {
      public: [
        'GET  /api/health',
        'GET  /api/dtc-db',
        'GET  /api/dtc-db/:code',
        'GET  /api/motors',
        'GET  /api/motors/lookup?part_number=...',
      ],
      protected: [
        'POST /api/ai/diagnose',
        'POST /api/ai/chat',
        'POST /api/sessions',
        'GET  /api/sessions',
        'GET  /api/sessions/:id',
        'PATCH /api/sessions/:id',
        'POST /api/feedback',
      ],
    },
  });
});

app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Terjadi kesalahan internal.',
  });
});

// ============================================
// Server Startup
// ============================================
async function start() {
  console.log('============================================');
  console.log('  WRT Garage — Backend API Server v2.0');
  console.log('  Honda PGM-FI AI Diagnostic Tool');
  console.log('============================================');
  console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Port        : ${PORT}`);
  console.log(`  AI Provider : Google Gemini (${process.env.GEMINI_MODEL || 'gemini-3.5-flash'})`);
  console.log('============================================');

  // Test database connection
  const dbOk = await db.testConnection();
  if (!dbOk) {
    console.error('[Server] ❌ Database connection failed. Server will start but DB features unavailable.');
  } else {
    // Run migrations on startup
    try {
      await db.migrate();
      console.log('[Server] ✅ Database migrations applied.');
    } catch (err) {
      console.error('[Server] ⚠️ Migration warning:', err.message);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] ✅ Listening on http://0.0.0.0:${PORT}`);
    console.log('[Server] Ready to diagnose Honda PGM-FI! 🏍️');
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received. Shutting down...');
  await db.close();
  process.exit(0);
});

start();

module.exports = app;
