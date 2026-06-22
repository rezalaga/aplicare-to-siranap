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
      const payload = {
        kode_rs: this.rsId,
        timestamp: new Date().toISOString(),
        data: bedData,
      };

      const response = await axios.post(
        `${this.baseUrl}/fo/index.php/Fasyankes`,
        payload,
        {
          headers: this._buildHeaders(),
          timeout: 15000,
        }
      );

      return {
        success: true,
        statusCode: response.status,
        message: response.data?.message || 'Data berhasil dikirim ke SIRANAP',
        data: response.data,
      };
    } catch (error) {
      throw this._handleError('updateBedAvailability', error);
    }
  }

  /**
   * Ambil data referensi ruang dari SIRANAP (GET)
   * GET /fo/poliklinik/get_tt_siranap/{kode_rs}
   */
  async getBedData() {
    if (!this.isConfigured()) {
      return { success: true, data: [], message: 'Mode demo - kredensial belum dikonfigurasi' };
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/fo/poliklinik/get_tt_siranap/${this.rsId}`,
        {
          headers: this._buildHeaders(),
          timeout: 10000,
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
