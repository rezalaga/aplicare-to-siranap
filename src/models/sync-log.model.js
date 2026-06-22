'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Pastikan direktori data ada
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'sync.db');

class SyncLogModel {
  constructor() {
    this.db = new Database(DB_PATH);
    this._initTable();
  }

  /**
   * Inisialisasi tabel SQLite
   */
  _initTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL DEFAULT 'running',
        trigger TEXT DEFAULT 'auto',
        message TEXT,
        rooms_count INTEGER DEFAULT 0,
        total_kapasitas INTEGER DEFAULT 0,
        total_tersedia INTEGER DEFAULT 0,
        total_terpakai INTEGER DEFAULT 0,
        siranap_status INTEGER,
        is_simulated INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        raw_data TEXT,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);
    `);
  }

  /**
   * Buat log entry baru
   * @returns {number} ID log yang baru dibuat
   */
  createLog(data = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_logs (status, trigger, started_at, created_at)
      VALUES (@status, @trigger, @started_at, datetime('now', 'localtime'))
    `);

    const result = stmt.run({
      status: data.status || 'running',
      trigger: data.trigger || 'auto',
      started_at: data.started_at || new Date().toISOString(),
    });

    return result.lastInsertRowid;
  }

  /**
   * Update log entry berdasarkan ID
   */
  updateLog(id, data = {}) {
    const stmt = this.db.prepare(`
      UPDATE sync_logs SET
        status = COALESCE(@status, status),
        message = COALESCE(@message, message),
        rooms_count = COALESCE(@rooms_count, rooms_count),
        total_kapasitas = COALESCE(@total_kapasitas, total_kapasitas),
        total_tersedia = COALESCE(@total_tersedia, total_tersedia),
        total_terpakai = COALESCE(@total_terpakai, total_terpakai),
        siranap_status = COALESCE(@siranap_status, siranap_status),
        is_simulated = COALESCE(@is_simulated, is_simulated),
        duration_ms = COALESCE(@duration_ms, duration_ms),
        raw_data = COALESCE(@raw_data, raw_data),
        finished_at = datetime('now', 'localtime')
      WHERE id = @id
    `);

    stmt.run({
      id,
      status: data.status || null,
      message: data.message || null,
      rooms_count: data.rooms_count ?? null,
      total_kapasitas: data.total_kapasitas ?? null,
      total_tersedia: data.total_tersedia ?? null,
      total_terpakai: data.total_terpakai ?? null,
      siranap_status: data.siranap_status ?? null,
      is_simulated: data.is_simulated ? 1 : 0,
      duration_ms: data.duration_ms ?? null,
      raw_data: data.raw_data || null,
    });
  }

  /**
   * Ambil semua log (terbaru di atas), dengan limit
   */
  getLogs(limit = 50, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT id, status, trigger, message, rooms_count, total_kapasitas,
             total_tersedia, total_terpakai, siranap_status, is_simulated,
             duration_ms, started_at, finished_at, created_at
      FROM sync_logs
      ORDER BY id DESC
      LIMIT @limit OFFSET @offset
    `);
    return stmt.all({ limit, offset });
  }

  /**
   * Ambil jumlah total log
   */
  countLogs() {
    const stmt = this.db.prepare('SELECT COUNT(*) as total FROM sync_logs');
    return stmt.get().total;
  }

  /**
   * Ambil log sukses terakhir (untuk mendapatkan raw_data terbaru)
   */
  getLastSuccessLog() {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_logs
      WHERE status = 'success'
      ORDER BY id DESC
      LIMIT 1
    `);
    return stmt.get();
  }

  /**
   * Statistik ringkasan
   */
  getStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as total_warning,
        AVG(duration_ms) as avg_duration_ms,
        MAX(created_at) as last_sync_at
      FROM sync_logs
      WHERE status != 'running'
    `);
    return stmt.get();
  }

  /**
   * Hapus log yang lebih dari N hari yang lalu
   */
  cleanOldLogs(daysToKeep = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM sync_logs
      WHERE created_at < datetime('now', '-${daysToKeep} days', 'localtime')
    `);
    const result = stmt.run();
    return result.changes;
  }
}

module.exports = new SyncLogModel();
