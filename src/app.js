'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const apiRoutes = require('./routes/api.routes');
const bridgeService = require('./services/bridge.service');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------------
// Middleware
// -------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (dashboard web) — tanpa cache agar update langsung terlihat
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  },
}));

// -------------------------------------------------------
// Routes
// -------------------------------------------------------
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[SERVER_ERROR] ${err.stack}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Semua route lain → dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------------------------------
// Cron Scheduler (dengan runtime control)
// -------------------------------------------------------
let scheduledTask = null;
let schedulerRunning = false;
let currentCronExpression = process.env.SYNC_CRON || '*/15 * * * *';
const SYNC_ENABLED = process.env.SYNC_ENABLED !== 'false';

function createScheduler(cronExpression) {
  if (scheduledTask) scheduledTask.stop();
  const expr = cron.validate(cronExpression) ? cronExpression : '*/15 * * * *';
  currentCronExpression = expr;
  scheduledTask = cron.schedule(expr, async () => {
    try { await bridgeService.sync(); }
    catch (error) { console.error('[CRON] Error sinkronisasi otomatis:', error.message); }
  }, { timezone: 'Asia/Jakarta' });
  schedulerRunning = true;
  console.log(`[CRON] Scheduler: "${expr}" (berjalan)`);
  return scheduledTask;
}

if (SYNC_ENABLED) {
  createScheduler(currentCronExpression);
} else {
  console.log('[CRON] Scheduler dinonaktifkan (SYNC_ENABLED=false)');
}

app.set('scheduler', {
  start: () => {
    if (!scheduledTask || schedulerRunning) return false;
    scheduledTask.start();
    schedulerRunning = true;
    console.log(`[CRON] Scheduler dijalankan: "${currentCronExpression}"`);
    return true;
  },
  stop: () => {
    if (!scheduledTask || !schedulerRunning) return false;
    scheduledTask.stop();
    schedulerRunning = false;
    console.log(`[CRON] Scheduler dihentikan`);
    return true;
  },
  reschedule: (cronExpression) => {
    if (!cron.validate(cronExpression)) throw new Error(`Ekspresi cron tidak valid: "${cronExpression}"`);
    createScheduler(cronExpression);
    return currentCronExpression;
  },
  status: () => ({
    running: schedulerRunning,
    cron: currentCronExpression,
  }),
});

// -------------------------------------------------------
// Start Server
// -------------------------------------------------------
app.listen(PORT, () => {
  const rsName = process.env.RS_NAME || 'Rumah Sakit';
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      Bridge APLICARE BPJS → SIRANAP Kemenkes     ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  RS    : ${rsName.padEnd(40)}║`);
  console.log(`║  Port  : http://localhost:${PORT.toString().padEnd(22)} ║`);
  console.log(`║  Env   : ${(process.env.NODE_ENV || 'development').padEnd(40)}║`);
  console.log(`║  Cron  : ${currentCronExpression.padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
