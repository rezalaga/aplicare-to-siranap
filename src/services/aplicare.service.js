'use strict';

const crypto = require('crypto');
const axios = require('axios');

/**
 * Service untuk berkomunikasi dengan API APLICARE BPJS Kesehatan
 * Autentikasi menggunakan HMAC-SHA256 signature
 */
class AplicareService {
  constructor() {
    this.baseUrl = process.env.BPJS_BASE_URL || 'https://new-api.bpjs-kesehatan.go.id';
    this.consId = process.env.BPJS_CONS_ID;
    this.secretKey = process.env.BPJS_SECRET_KEY;
    this.userKey = process.env.BPJS_USER_KEY;
    this.kodePPK = process.env.BPJS_KODE_PPK;
  }

  /**
   * Generate timestamp Unix (detik sejak epoch 1970-01-01)
   */
  _generateTimestamp() {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Generate HMAC-SHA256 signature
   * Format: Base64(HMAC-SHA256(consId & timestamp, secretKey))
   */
  _generateSignature(timestamp) {
    const data = `${this.consId}&${timestamp}`;
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(data);
    return hmac.digest('base64');
  }

  /**
   * Buat header autentikasi BPJS
   */
  _buildHeaders() {
    const timestamp = this._generateTimestamp();
    const signature = this._generateSignature(timestamp);

    return {
      'X-cons-id': this.consId,
      'X-timestamp': timestamp,
      'X-signature': signature,
      'user_key': this.userKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Validasi konfigurasi kredensial
   */
  isConfigured() {
    return !!(this.consId && this.secretKey && this.userKey && this.kodePPK);
  }

  /**
   * Ambil referensi kelas kamar dari BPJS
   * GET /aplicaresws/rest/ref/kelas
   */
  async getKelasRuang() {
    if (!this.isConfigured()) {
      return this._getMockKelasRuang();
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/aplicaresws/rest/ref/kelas`,
        {
          headers: this._buildHeaders(),
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      throw this._handleError('getKelasRuang', error);
    }
  }

  /**
   * Ambil data ketersediaan tempat tidur
   * GET /aplicaresws/rest/bed/availablity/{kodeppk}
   */
  async getBedAvailability() {
    if (!this.isConfigured()) {
      console.warn('[APLICARE] Kredensial belum dikonfigurasi, menggunakan data mock.');
      return this._getMockBedData();
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/aplicaresws/rest/bed/read/${this.kodePPK}/1/100`,
        {
          headers: this._buildHeaders(),
          timeout: 30000,
        }
      );

      const data = response.data;

      // Cek apakah BPJS mengembalikan error di dalam JSON response (meskipun HTTP 200 OK)
      const meta = data.metadata || data.metaData;
      
      const isSuccess = meta && (meta.code === 200 || meta.code === '200' || meta.Code === 200 || meta.Code === '200' || meta.code === 1 || meta.code === '1');

      if (meta && !isSuccess) {
        const errorMsg = meta.message || 'Error dari BPJS';
        const errorCode = meta.code || meta.Code;
        throw new Error(`[BPJS] ${errorCode} - ${errorMsg}`);
      }

      // Handle berbagai format response BPJS yang sukses
      if (isSuccess) {
        if (data.response && Array.isArray(data.response.list)) {
          return data.response.list;
        }
        return data.response || [];
      } else if (Array.isArray(data)) {
        return data;
      } else if (data && data.response) {
        return Array.isArray(data.response) ? data.response : [data.response];
      }

      return [];
    } catch (error) {
      throw this._handleError('getBedAvailability', error);
    }
  }

  /**
   * Test koneksi ke API BPJS
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        connected: false,
        message: 'Kredensial BPJS belum dikonfigurasi di file .env',
        configured: false,
      };
    }

    try {
      await axios.get(
        `${this.baseUrl}/aplicaresws/rest/ref/kelas`,
        {
          headers: this._buildHeaders(),
          timeout: 8000,
        }
      );
      return { connected: true, message: 'Koneksi ke APLICARE BPJS berhasil', configured: true };
    } catch (error) {
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
      ? `[APLICARE:${method}] HTTP ${error.response.status} - ${JSON.stringify(error.response.data)}`
      : `[APLICARE:${method}] ${error.message}`;
    return new Error(msg);
  }

  // ============================================================
  // DATA MOCK — digunakan saat kredensial belum dikonfigurasi
  // ============================================================
  _getMockBedData() {
    return [
      {
        kodekelas: '1',
        kodekelas_nama: 'Kelas I',
        koderuang: 'R001',
        namaruang: 'Ruang Mawar',
        kapasitas: 20,
        tersedia: 8,
        tersediapria: 4,
        tersediawanita: 4,
        tersediapriawanita: 0,
      },
      {
        kodekelas: '2',
        kodekelas_nama: 'Kelas II',
        koderuang: 'R002',
        namaruang: 'Ruang Melati',
        kapasitas: 30,
        tersedia: 12,
        tersediapria: 6,
        tersediawanita: 6,
        tersediapriawanita: 0,
      },
      {
        kodekelas: '3',
        kodekelas_nama: 'Kelas III',
        koderuang: 'R003',
        namaruang: 'Ruang Kenanga',
        kapasitas: 40,
        tersedia: 15,
        tersediapria: 8,
        tersediawanita: 7,
        tersediapriawanita: 0,
      },
      {
        kodekelas: '4',
        kodekelas_nama: 'ICU',
        koderuang: 'R004',
        namaruang: 'Ruang ICU',
        kapasitas: 10,
        tersedia: 3,
        tersediapria: 2,
        tersediawanita: 1,
        tersediapriawanita: 0,
      },
      {
        kodekelas: '5',
        kodekelas_nama: 'VIP',
        koderuang: 'R005',
        namaruang: 'Ruang VIP',
        kapasitas: 15,
        tersedia: 5,
        tersediapria: 2,
        tersediawanita: 3,
        tersediapriawanita: 0,
      },
    ];
  }

  _getMockKelasRuang() {
    return [
      { kode: '1', nama: 'Kelas I' },
      { kode: '2', nama: 'Kelas II' },
      { kode: '3', nama: 'Kelas III' },
      { kode: '4', nama: 'ICU' },
      { kode: '5', nama: 'VIP' },
    ];
  }
}

module.exports = new AplicareService();
