'use strict';

const axios = require('axios');
const { getMapping } = require('./mapping.service');

/**
 * Service untuk berkomunikasi dengan API SIRANAP Kementerian Kesehatan
 * Autentikasi menggunakan X-rs-id + X-pass + X-Timestamp
 */
class SiranapService {
  constructor() {
    this.baseUrl = process.env.SIRANAP_BASE_URL || 'https://sirs.kemkes.go.id';
    this.rsId = process.env.SIRANAP_RS_ID;
    this.password = process.env.SIRANAP_PASSWORD;
  }

  /**
   * Buat header autentikasi SIRANAP
   */
  _buildHeaders() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    return {
      'X-rs-id': this.rsId,
      'X-pass': this.password,
      'X-Timestamp': timestamp,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Validasi konfigurasi kredensial
   */
  isConfigured() {
    return !!(this.rsId && this.password);
  }

  /**
   * Kirim data ketersediaan tempat tidur ke SIRANAP
   * POST /fo/poliklinik/update_tt_siranap
   *
   * @param {Array} bedData - Array data tempat tidur yang sudah ditransformasi
   * @returns {Object} response dari server SIRANAP
   */
  async updateBedAvailability(bedData) {
    if (!this.isConfigured()) {
      console.warn('[SIRANAP] Kredensial belum dikonfigurasi, simulasi pengiriman data.');
      return this._mockSuccess(bedData);
    }

    try {
      // 1. Dapatkan data eksisting di SIRANAP untuk menentukan id_t_tt
      const existingRes = await this.getBedData();
      const existingRooms = existingRes.success && Array.isArray(existingRes.data) 
        ? existingRes.data 
        : (existingRes.success && existingRes.data && existingRes.data.fasyankes ? existingRes.data.fasyankes : []);
      
      const existingMap = new Map();
      existingRooms.forEach(room => {
        if (!room.ruang) return;
        existingMap.set(room.ruang + '|' + room.id_tt, room);
      });

      // 2. Mapping kode kelas Aplicare ke id_tt SIRANAP (via mapping.service)
      let successCount = 0;
      let errorCount = 0;
      let lastError = null;

      // 3. Kirim data secara batch (maksimal 5 request sekaligus)
      const BATCH_SIZE = 5;

      for (let i = 0; i < bedData.length; i += BATCH_SIZE) {
        const batch = bedData.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(async (bed) => {
          const id_tt = getMapping(bed.kode_kelas, bed.nama_kelas).id_tt;
          const nama = bed.nama_ruang || '';
          const parts = nama.split(' ');
          let ruang = parts.length > 1 ? parts[parts.length - 1] : nama;
          if (nama.startsWith('HDU')) ruang = ruang.padStart(2, '0');
          let existingRoom = existingMap.get(ruang + '|' + id_tt);
          if (nama !== ruang) {
            const old = existingMap.get(nama + '|' + id_tt);
            if (old) {
              try {
                await axios.delete(`${this.baseUrl}/fo/index.php/Fasyankes`, {
                  data: { id_t_tt: old.id_t_tt },
                  headers: this._buildHeaders(),
                  timeout: 10000
                });
                console.log(`[SIRANAP] Hapus room ${nama}, buat ${ruang}`);
              } catch (e) {
                console.log(`[SIRANAP] Gagal hapus ${nama}, fallback PUT`);
                existingRoom = existingRoom || old;
                if (!existingRoom) ruang = nama;
              }
            }
          }
          let method = 'post';
          let id_t_tt = null;

          if (existingRoom) {
            id_tt = existingRoom.id_tt;
            id_t_tt = existingRoom.id_t_tt;
            method = 'put';
          }

          const payload = {
            id_tt: id_tt,
            ruang: ruang,
            jumlah_ruang: '0',
            jumlah: bed.total_tt.toString(),
            terpakai: bed.terpakai.toString(),
            terpakai_suspek: '0',
            terpakai_konfirmasi: '0',
            prepare: '0',
            prepare_plan: '0',
            covid: '0',
            antrian: '0'
          };

          if (id_t_tt) payload.id_t_tt = id_t_tt;

          const res = await axios({
            method: method,
            url: `${this.baseUrl}/fo/index.php/Fasyankes`,
            data: payload,
            headers: this._buildHeaders(),
            timeout: 10000
          });

          let responseMsg = '';
          if (res.data && res.data.fasyankes && res.data.fasyankes.length > 0) {
            responseMsg = res.data.fasyankes[0].message || '';
          }

          if (method === 'put' && responseMsg.includes('belum ada di database')) {
            delete payload.id_t_tt;
            await axios({
              method: 'post',
              url: `${this.baseUrl}/fo/index.php/Fasyankes`,
              data: payload,
              headers: this._buildHeaders(),
              timeout: 10000
            });
          }
          return res;
        }));

        results.forEach(res => {
          if (res.status === 'fulfilled') successCount++;
          else {
            errorCount++;
            lastError = res.reason;
          }
        });
      }

      if (errorCount > 0 && successCount === 0) {
        throw lastError; // Semua gagal
      }

      return {
        success: true,
        statusCode: 200,
        message: `Data berhasil dikirim ke SIRANAP (${successCount} sukses, ${errorCount} gagal)`,
        data: { success: successCount, failed: errorCount }
      };
    } catch (error) {
      throw this._handleError('updateBedAvailability', error);
    }
  }

  /**
   * Ambil data referensi ruang dari SIRANAP (GET)
   * GET /fo/index.php/Fasyankes
   */
  async getBedData() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/fo/index.php/Fasyankes`,
        {
          headers: this._buildHeaders(),
          timeout: 10000
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: [], message: error.message };
    }
  }

  /**
   * Hapus semua data tempat tidur di SIRANAP
   * DELETE per ruang via API, fallback zero-out jika DELETE tidak didukung
   */
  async clearBedData() {
    if (!this.isConfigured()) {
      return { success: true, message: '[DEMO] Simulasi penghapusan data', simulated: true };
    }

    try {
      const existing = await this.getBedData();
      const rooms = existing.success && Array.isArray(existing.data)
        ? existing.data
        : (existing.data && existing.data.fasyankes ? existing.data.fasyankes : []);

      if (rooms.length === 0) {
        return { success: true, message: 'Tidak ada data tempat tidur di SIRANAP' };
      }

      let deleted = 0;
      let zeroed = 0;

      for (const room of rooms) {
        if (!room.id_t_tt && !room.id_tt) continue;

        try {
          await axios({
            method: 'delete',
            url: `${this.baseUrl}/fo/index.php/Fasyankes`,
            data: { id_t_tt: room.id_t_tt, id_tt: room.id_tt, ruang: room.ruang },
            headers: this._buildHeaders(),
            timeout: 8000,
          });
          deleted++;
        } catch {
          // fallback: zero-out
          await axios({
            method: 'put',
            url: `${this.baseUrl}/fo/index.php/Fasyankes`,
            data: {
              id_t_tt: room.id_t_tt,
              id_tt: room.id_tt,
              ruang: room.ruang,
              jumlah_ruang: '0',
              jumlah: '0',
              terpakai: '0',
              terpakai_suspek: '0',
              terpakai_konfirmasi: '0',
              prepare: '0',
              prepare_plan: '0',
              covid: '0',
              antrian: '0'
            },
            headers: this._buildHeaders(),
            timeout: 8000,
          });
          zeroed++;
        }
      }

      return {
        success: true,
        message: `Data dibersihkan: ${deleted} dihapus, ${zeroed} di-nol-kan`,
        deleted,
        zeroed,
      };
    } catch (error) {
      throw this._handleError('clearBedData', error);
    }
  }

  /**
   * Test koneksi ke API SIRANAP
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        connected: false,
        message: 'Kredensial SIRANAP belum dikonfigurasi di file .env',
        configured: false,
      };
    }

    try {
      await axios.post(
        `${this.baseUrl}/fo/index.php/Fasyankes`,
        {},
        {
          headers: this._buildHeaders(),
          timeout: 8000,
        }
      );
      return { connected: true, message: 'Koneksi ke SIRANAP Kemenkes berhasil', configured: true };
    } catch (error) {
      // Status 404 masih berarti server bisa dijangkau
      if (error.response && error.response.status < 500) {
        return {
          connected: true,
          message: `Server SIRANAP dapat dijangkau (HTTP ${error.response.status})`,
          configured: true,
        };
      }
      return {
        connected: false,
        message: error.response
          ? `HTTP ${error.response.status}: ${error.response.statusText}`
          : error.message,
        configured: true,
      };
    }
  }

  /**
   * Format error yang konsisten
   */
  _handleError(method, error) {
    const msg = error.response
      ? `[SIRANAP:${method}] HTTP ${error.response.status} - ${JSON.stringify(error.response.data)}`
      : `[SIRANAP:${method}] ${error.message}`;
    return new Error(msg);
  }

  /**
   * Simulasi response sukses (mode demo)
   */
  _mockSuccess(bedData) {
    return {
      success: true,
      statusCode: 200,
      message: `[DEMO] Simulasi pengiriman ${bedData.length} ruang berhasil`,
      data: { total: bedData.length, status: 'simulated' },
      simulated: true,
    };
  }
}

module.exports = new SiranapService();
