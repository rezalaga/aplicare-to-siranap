'use strict';

const express = require('express');
const router = express.Router();

const aplicareService = require('../services/aplicare.service');
const siranapService = require('../services/siranap.service');
const bridgeService = require('../services/bridge.service');
const syncLogModel = require('../models/sync-log.model');

// Middleware sederhana untuk autentikasi API Key
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.API_KEY || 'default-secret-key';
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized: API Key tidak valid' });
  }
  next();
};

// -------------------------------------------------------
// GET /api/status
// Status aplikasi, konfigurasi, dan koneksi
// -------------------------------------------------------
router.get('/status', async (req, res) => {
  try {
    const [bpjsConn, siranapConn] = await Promise.allSettled([
      aplicareService.testConnection(),
      siranapService.testConnection(),
    ]);

    const stats = syncLogModel.getStats();
    const lastLog = syncLogModel.getLogs(1)[0] || null;

    res.json({
      success: true,
      app: {
        name: 'Bridge APLICARE → SIRANAP',
        version: '1.0.0',
        rs_name: process.env.RS_NAME || 'Rumah Sakit',
        environment: process.env.NODE_ENV || 'development',
        sync_cron: process.env.SYNC_CRON || '*/15 * * * *',
        sync_enabled: process.env.SYNC_ENABLED !== 'false',
        uptime_seconds: Math.floor(process.uptime()),
      },
      connections: {
        bpjs: bpjsConn.status === 'fulfilled' ? bpjsConn.value : { connected: false, message: bpjsConn.reason?.message },
        siranap: siranapConn.status === 'fulfilled' ? siranapConn.value : { connected: false, message: siranapConn.reason?.message },
      },
      stats: {
        total_syncs: stats?.total || 0,
        total_success: stats?.total_success || 0,
        total_failed: stats?.total_failed || 0,
        total_warning: stats?.total_warning || 0,
        avg_duration_ms: Math.round(stats?.avg_duration_ms || 0),
        last_sync_at: stats?.last_sync_at || null,
      },
      last_sync: lastLog,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// GET /api/logs
// Riwayat sinkronisasi dengan pagination
// -------------------------------------------------------
router.get('/logs', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const logs = syncLogModel.getLogs(limit, offset);
    const total = syncLogModel.countLogs();

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// POST /api/sync/manual
// Trigger sinkronisasi manual
// -------------------------------------------------------
router.post('/sync/manual', authMiddleware, async (req, res) => {
  try {
    console.log('[API] Sinkronisasi manual dipicu via web dashboard');
    const result = await bridgeService.syncManual('manual-web');
    res.json({
      success: result.success,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error('[API] Error sinkronisasi manual:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// -------------------------------------------------------
// POST /api/sync/clear-and-resync
// Hapus data di SIRANAP lalu kirim ulang dari APLICARE
// -------------------------------------------------------
router.post('/sync/clear-and-resync', authMiddleware, async (req, res) => {
  try {
    console.log('[API] Clear & Resync dipicu...');

    const clearResult = await siranapService.clearBedData();
    console.log(`[API] Clear selesai: ${clearResult.message}`);

    const syncResult = await bridgeService.syncManual('clear-resync');

    res.json({
      success: syncResult.success,
      message: `Clear: ${clearResult.message} | Sync: ${syncResult.message}`,
      data: {
        clear: clearResult,
        sync: syncResult,
      },
    });
  } catch (error) {
    console.error('[API] Error clear & resync:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// -------------------------------------------------------
// GET /api/bed-data
// Data tempat tidur terakhir dari cache log
// -------------------------------------------------------
router.get('/bed-data', (req, res) => {
  try {
    const bedData = bridgeService.getLastBedData();
    const lastLog = syncLogModel.getLastSuccessLog();

    res.json({
      success: true,
      total_rooms: bedData.length,
      last_updated: lastLog?.finished_at || null,
      data: bedData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// GET /api/config
// Konfigurasi yang aktif (tanpa secret)
// -------------------------------------------------------
router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: {
      bpjs: {
        base_url: process.env.BPJS_BASE_URL || '(tidak dikonfigurasi)',
        cons_id: process.env.BPJS_CONS_ID ? `${process.env.BPJS_CONS_ID.substring(0, 4)}****` : '(tidak dikonfigurasi)',
        kode_ppk: process.env.BPJS_KODE_PPK || '(tidak dikonfigurasi)',
        configured: aplicareService.isConfigured(),
      },
      siranap: {
        base_url: process.env.SIRANAP_BASE_URL || '(tidak dikonfigurasi)',
        rs_id: process.env.SIRANAP_RS_ID || '(tidak dikonfigurasi)',
        configured: siranapService.isConfigured(),
      },
      scheduler: {
        cron: process.env.SYNC_CRON || '*/15 * * * *',
        enabled: process.env.SYNC_ENABLED !== 'false',
      },
    },
  });
});

module.exports = router;
