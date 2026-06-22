'use strict';

const axios = require('axios');

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
        // Simpan id_t_tt berdasarkan kombinasi id_tt dan ruang
        existingMap.set(`${room.id_tt}#${room.ruang}`, room.id_t_tt);
      });

      // 2. Mapping kode kelas BPJS ke id_tt SIRANAP
      const classMap = {
        'VVIP': '1', 'VIP': '2', 'KL1': '3', 'KL2': '4', 'KL3': '5',
        'ICU': '6', 'HCU': '7', 'ICC': '8', 'NIC': '10', 'PIC': '11', 'ISO': '12'
      };

      let successCount = 0;
      let errorCount = 0;
      let lastError = null;

      // 3. Kirim data satu per satu
      for (const bed of bedData) {
        const id_tt = classMap[bed.kode_kelas] || '5'; // fallback
        const ruang = bed.nama_ruang;
        
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

        const existingId_t_tt = existingMap.get(`${id_tt}#${ruang}`);
        let method = 'post';

        // Jika kamar sudah ada di SIRANAP, inject id_t_tt ke payload dan gunakan PUT
        if (existingId_t_tt) {
          payload.id_t_tt = existingId_t_tt;
          method = 'put';
        }

        try {
          const res = await axios({
            method: method,
            url: `${this.baseUrl}/fo/index.php/Fasyankes`,
            data: payload,
            headers: this._buildHeaders(),
            timeout: 10000
          });

          // Pengecekan fallback (hanya berjaga-jaga jika ada asinkronisasi DB Kemenkes)
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

          successCount++;
        } catch (err) {
          errorCount++;
          lastError = err;
          console.error(`[SIRANAP] Gagal memproses ruang ${ruang}:`, err.response?.status, err.response?.data || err.message);
        }
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
      // Non-fatal: return empty jika belum ada data
      return { success: false, data: [], message: error.message };
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
