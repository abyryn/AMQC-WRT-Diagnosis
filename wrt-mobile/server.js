// ============================================
// WRT Garage — Web & Mobile Frontend Server
// Serves static web frontend on localhost:8080
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');

// Auto-load environment variables from .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = req.url.split('?')[0];

  // Dynamic runtime configuration injection from environment (.env)
  if (reqPath === '/config.js') {
    const hostHeader = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
    const dynamicApiBase = process.env.API_BASE_URL || `http://${hostHeader}:3000/api`;
    const configPayload = {
      API_BASE_URL: dynamicApiBase,
      API_KEY: process.env.API_KEY || 'wrt-garage-api-key-change-this-in-production',
      DEFAULT_PRINTER_IP: process.env.DEFAULT_PRINTER_IP || '192.168.1.100',
      DEFAULT_PRINTER_PORT: parseInt(process.env.DEFAULT_PRINTER_PORT) || 9100,
    };
    const body = `window.__ENV__ = Object.freeze(${JSON.stringify(configPayload, null, 2)});`;
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(body);
    return;
  }

  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routing
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const backendUrl = process.env.API_BASE_URL || `http://localhost:3000/api`;
  console.log('============================================');
  console.log('  WRT Garage — Frontend Web & Mobile App v2.0');
  console.log('  Honda PGM-FI AI Diagnostic Tool');
  console.log('============================================');
  console.log(`  Local URL   : http://localhost:${PORT}`);
  console.log(`  Network URL : http://0.0.0.0:${PORT}`);
  console.log(`  Backend API : ${backendUrl}`);
  console.log('============================================');
});

module.exports = server;
