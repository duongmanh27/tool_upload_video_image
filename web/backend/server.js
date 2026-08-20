/**
 * server.js — Entry Point Express Server
 * Media Upload Tool - Cloudflare R2 Backend
 * Port: 3000
 */

const path = require('path');

// Load .env từ root project (2 cấp lên từ web/backend/)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');

const uploadRoute = require('./src/routes/upload');
const albumRoute = require('./src/routes/album');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Serve Frontend (Static Files) ─────────────────────────────────────────────
// Frontend nằm ở web/frontend/ (1 cấp lên từ web/backend/, rồi vào frontend/)
const FRONTEND_DIR = path.join(__dirname, '../frontend');
app.use(express.static(FRONTEND_DIR));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/upload', uploadRoute);
app.use('/api/album', albumRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    bucket: 'my-storge-tool',
    endpoint: (process.env.Endpoint_URL || '').trim(),
  });
});

// ── SPA Fallback: album.html & index.html ─────────────────────────────────────
app.get('/album.html', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'album.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    🚀  Media Upload Tool  —  Server Ready         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐  Local:    http://localhost:${PORT}             ║`);
  console.log(`║  ☁️   Bucket:  my-storge-tool (Cloudflare R2)     ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
