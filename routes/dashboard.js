/**
 * StreamVault — Dashboard API Routes
 * Add to server.js: const dashboardRoutes = require('./routes/dashboard');
 *                   app.use('/api/dashboard', dashboardRoutes);
 */

const express = require('express');
const router  = express.Router();
const tracker = require('../middleware/tracker');
const os      = require('os');

// ── CORS for your PHP dashboard domain ────────────────────────────────────────
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://streamvault.fit');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dashboard-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── GET /api/dashboard/ping — lightweight health check ────────────────────────
router.get('/ping', (req, res) => {
  res.json({
    ok:         true,
    ts:         Date.now(),
    uptime:     Math.floor(process.uptime()),
    nodeVersion: process.version,
    memory:     process.memoryUsage(),
    loadAvg:    os.loadavg(),
    freemem:    os.freemem(),
    totalmem:   os.totalmem(),
  });
});

// ── GET /api/dashboard/stats — full stats payload ─────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const stats = tracker.getStats();
    res.json(stats);
  } catch (e) {
    console.error('[Dashboard] Stats error:', e.message);
    res.status(500).json({ error: 'Stats unavailable', msg: e.message });
  }
});

module.exports = router;
