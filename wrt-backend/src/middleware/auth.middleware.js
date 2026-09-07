// ============================================
// WRT Garage — Auth Middleware
// API Key validation
// ============================================

function authMiddleware(req, res, next) {
  // Health and public endpoints skip auth
  const publicPaths = ['/api/health', '/api/dtc-db'];
  if (publicPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Set X-API-Key header or Authorization: Bearer <key>',
    });
  }

  // In production, validate against database or secret env. For development, fallback to default dev key.
  const validKey = process.env.API_KEY_SECRET || 'wrt-garage-api-key-change-this-in-production';
  if (apiKey !== validKey && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
  }

  next();
}

module.exports = authMiddleware;
