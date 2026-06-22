'use strict';

const aplicareService = require('./aplicare.service');
const siranapService = require('./siranap.service');
const syncLogModel = require('../models/sync-log.model');

/**
 * Service utama: mengambil data dari APLICARE BPJS,
 * mentransformasi, dan mengirim ke SIRANAP Kemenkes
 */
class BridgeService {
  /**
   * Eksekusi satu siklus sinkronisasi penuh
   * @returns {Object} hasil sinkronisasi
   */
  async sync() {
    const startTime = Date.now();
    console.log(`[BRIDGE] Memulai sinkronisasi: ${new Date().toISOString()}`);

    let logId = null;
    try {
      // 1. Buat log entry awal dengan status "running"
      logId = syncLogModel.createLog({
        status: 'running',
        trigger: 'auto',
        started_at: new Date().toISOString(),
      });

      // 2. Ambil data dari APLICARE BPJS
      console.log('[BRIDGE] Mengambil data dari APLICARE BPJS...');
      const rawData = await aplicareService.getBedAvailability();

      if (!rawData || rawData.length === 0) {
        const result = {
          success: false,
          message: 'Tidak ada data tempat tidur dari APLICARE BPJS',
          duration_ms: Date.now() - startTime,
          rooms_count: 0,
        };
        syncLogModel.updateLog(logId, { status: 'warning', ...result });
        return result;
      }

      console.log(`[BRIDGE] Diterima ${rawData.length} data ruang dari BPJS`);

      // 3. Transformasi data ke format SIRANAP
      const transformedData = this.transformToSiranap(rawData);
      console.log(`[BRIDGE] Transformasi selesai: ${transformedData.length} ruang`);

      // 4. Kirim ke SIRANAP Kemenkes
      console.log('[BRIDGE] Mengirim data ke SIRANAP Kemenkes...');
      const siranapResponse = await siranapService.updateBedAvailability(transformedData);

      // 5. Hitung statistik
      const totalKapasitas = rawData.reduce((sum, r) => sum + (r.kapasitas || 0), 0);
      const totalTersedia = rawData.reduce((sum, r) => sum + (r.tersedia || 0), 0);
      const totalTerpakai = totalKapasitas - totalTersedia;

      const result = {
        success: siranapResponse.success,
        message: siranapResponse.message,
        duration_ms: Date.now() - startTime,
        rooms_count: transformedData.length,
        total_kapasitas: totalKapasitas,
        total_tersedia: totalTersedia,
        total_terpakai: totalTerpakai,
        siranap_status: siranapResponse.statusCode,
        is_simulated: siranapResponse.simulated || false,
      };

      // 6. Simpan data bed terbaru ke cache log
      syncLogModel.updateLog(logId, {
        status: result.success ? 'success' : 'failed',
        ...result,
        raw_data: JSON.stringify(rawData),
      });

      console.log(`[BRIDGE] Sinkronisasi selesai dalam ${result.duration_ms}ms`);
      return result;
    } catch (error) {
      console.error(`[BRIDGE] Error sinkronisasi: ${error.message}`);

      if (logId) {
        syncLogModel.updateLog(logId, {
          status: 'failed',
          message: error.message,
          duration_ms: Date.now() - startTime,
          rooms_count: 0,
        });
      }

      throw error;
    }
  }

  /**
   * Trigger sinkronisasi manual
   * @param {string} triggeredBy - siapa yang memicu (user, admin, dsb)
   */
  async syncManual(triggeredBy = 'manual') {
    const startTime = Date.now();
    let logId = null;

    try {
      logId = syncLogModel.createLog({
        status: 'running',
        trigger: triggeredBy,
        started_at: new Date().toISOString(),
      });

      const rawData = await aplicareService.getBedAvailability();

      if (!rawData || rawData.length === 0) {
        const result = {
          success: false,
          message: 'Tidak ada data dari APLICARE BPJS',
          duration_ms: Date.now() - startTime,
          rooms_count: 0,
        };
        syncLogModel.updateLog(logId, { status: 'warning', ...result });
        return result;
      }

      const transformedData = this.transformToSiranap(rawData);
      const siranapResponse = await siranapService.updateBedAvailability(transformedData);

      const totalKapasitas = rawData.reduce((sum, r) => sum + (r.kapasitas || 0), 0);
      const totalTersedia = rawData.reduce((sum, r) => sum + (r.tersedia || 0), 0);

      const result = {
        success: siranapResponse.success,
        message: siranapResponse.message,
        duration_ms: Date.now() - startTime,
        rooms_count: transformedData.length,
        total_kapasitas: totalKapasitas,
        total_tersedia: totalTersedia,
        total_terpakai: totalKapasitas - totalTersedia,
        siranap_status: siranapResponse.statusCode,
        is_simulated: siranapResponse.simulated || false,
        raw_data_preview: rawData.slice(0, 3), // preview 3 item pertama
      };

      syncLogModel.updateLog(logId, {
        status: result.success ? 'success' : 'failed',
        ...result,
        raw_data: JSON.stringify(rawData),
      });

      return result;
    } catch (error) {
      if (logId) {
        syncLogModel.updateLog(logId, {
          status: 'failed',
          message: error.message,
          duration_ms: Date.now() - startTime,
          rooms_count: 0,
        });
      }
      throw error;
    }
  }

  /**
   * Transformasi data dari format APLICARE BPJS ke format SIRANAP Kemenkes
   *
   * Format APLICARE:
   * { kodekelas, kodekelas_nama, koderuang, namaruang, kapasitas, tersedia,
   *   tersediapria, tersediawanita, tersediapriawanita }
   *
   * Format SIRANAP:
   * { kode_ruang, nama_ruang, kode_kelas, nama_kelas, total_tt, terpakai,
   *   kosong, kosong_pria, kosong_wanita, tersedia_priaWanita }
   */
  transformToSiranap(bedData) {
    return bedData.map((room) => {
      const kapasitas = parseInt(room.kapasitas) || 0;
      const tersedia = parseInt(room.tersedia) || 0;
      const terpakai = kapasitas - tersedia;

      return {
        kode_ruang: room.koderuang || '',
        nama_ruang: room.namaruang || '',
        kode_kelas: room.kodekelas || '',
        nama_kelas: room.kodekelas_nama || '',
        total_tt: kapasitas,
        terpakai: terpakai > 0 ? terpakai : 0,
        kosong: tersedia,
        kosong_pria: parseInt(room.tersediapria) || 0,
        kosong_wanita: parseInt(room.tersediawanita) || 0,
        tersedia_priaWanita: parseInt(room.tersediapriawanita) || 0,
        updated_at: new Date().toISOString(),
      };
    });
  }

  /**
   * Ambil data tempat tidur terbaru dari log terakhir
   */
  getLastBedData() {
    const lastLog = syncLogModel.getLastSuccessLog();
    if (!lastLog || !lastLog.raw_data) return [];

    try {
      const rawData = JSON.parse(lastLog.raw_data);
      return this.transformToSiranap(rawData);
    } catch {
      return [];
    }
  }
}

module.exports = new BridgeService();
