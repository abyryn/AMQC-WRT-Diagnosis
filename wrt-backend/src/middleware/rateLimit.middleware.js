// ============================================
// WRT Garage — Rate Limiter Middleware
// ============================================
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Terlalu banyak request. Coba lagi dalam 1 menit.',
    retry_after_ms: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  },
});

// Stricter limit for AI endpoints (costs money per query)
const aiLimiter = rateLimit({
  windowMs: 60000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many AI Requests',
    message: 'Batas query AI tercapai. Maksimal 10 request per menit.',
  },
});

module.exports = { apiLimiter, aiLimiter };
