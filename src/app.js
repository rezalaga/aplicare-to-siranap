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

// Static files (dashboard web)
app.use(express.static(path.join(__dirname, 'public')));

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
// Cron Scheduler
// -------------------------------------------------------
const SYNC_CRON = process.env.SYNC_CRON || '*/15 * * * *';
const SYNC_ENABLED = process.env.SYNC_ENABLED !== 'false';

if (SYNC_ENABLED) {
  if (!cron.validate(SYNC_CRON)) {
    console.error(`[CRON] Ekspresi cron tidak valid: "${SYNC_CRON}". Menggunakan default: "*/15 * * * *"`);
  }

  const cronExpression = cron.validate(SYNC_CRON) ? SYNC_CRON : '*/15 * * * *';

  cron.schedule(cronExpression, async () => {
    try {
      await bridgeService.sync();
    } catch (error) {
      console.error('[CRON] Error sinkronisasi otomatis:', error.message);
    }
  }, {
    timezone: 'Asia/Jakarta',
  });

  console.log(`[CRON] Scheduler aktif dengan jadwal: "${cronExpression}" (WIB)`);
} else {
  console.log('[CRON] Scheduler dinonaktifkan (SYNC_ENABLED=false)');
}

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
  console.log(`║  Port  : http://localhost:${PORT.toString().padEnd(22)}║`);
  console.log(`║  Env   : ${(process.env.NODE_ENV || 'development').padEnd(40)}║`);
  console.log(`║  Cron  : ${SYNC_CRON.padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
