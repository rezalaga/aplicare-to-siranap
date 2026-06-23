# Bridge APLICARE BPJS → SIRANAP Kemenkes

Aplikasi jembatan otomatis (bridge) untuk mengambil data ketersediaan tempat tidur dari API APLICARE BPJS Kesehatan dan mengirimkannya (push) ke API SIRANAP Kementerian Kesehatan RI.

## Fitur Utama

- 🔄 **Sinkronisasi Otomatis**: Dilengkapi dengan scheduler (cron) untuk melakukan sinkronisasi otomatis sesuai interval waktu yang diinginkan (default: 15 menit).
- 🔒 **Autentikasi Aman**: Menggunakan metode HMAC-SHA256 untuk mengakses layanan BPJS APLICARE.
- 📊 **Dashboard Real-time**: Antarmuka web modern dengan Dark Mode untuk memantau status koneksi, jumlah ruang, kapasitas, tingkat hunian, dan riwayat sinkronisasi.
- 🗄️ **Database Lokal**: Menyimpan log aktivitas dan riwayat sinkronisasi di database SQLite ringan untuk keperluan audit/monitoring.
- 🐳 **Docker-Ready**: Mudah di-deploy menggunakan Docker dan Docker Compose tanpa perlu setup environment manual.

## Prasyarat

Sebelum menjalankan aplikasi ini, pastikan Anda telah memiliki kredensial API resmi:
1. **APLICARE BPJS**: `Consumer ID`, `Consumer Secret`, `User Key`, dan `Kode PPK`.
2. **SIRANAP Kemenkes**: `Kode RS` dan `Password Bridging` dari portal RS-Online/SIRS.

## Instalasi & Menjalankan (via Docker)

Ini adalah cara yang disarankan untuk menjalankan aplikasi di server produksi.

1. **Clone/Copy Project** ke server Anda.
2. **Copy Konfigurasi**:
   ```bash
   cp .env.example .env
   ```
3. **Edit `.env`**: Masukkan kredensial BPJS dan SIRANAP Anda.
4. **Jalankan dengan Docker Compose**:
   ```bash
   docker compose up -d
   ```
5. Buka Dashboard di browser: `http://localhost:3000`

> **Catatan**: Direktori `data/` akan dibuat secara otomatis untuk menyimpan file database SQLite (`sync.db`).

## Pengembangan Lokal (Tanpa Docker)

Jika Anda ingin menjalankan tanpa Docker untuk keperluan development/testing:

1. Pastikan Anda telah menginstal **Node.js** (versi 20 atau lebih baru).
2. Instal dependencies:
   ```bash
   npm install
   ```
3. Copy dan edit `.env` seperti langkah di atas.
4. Jalankan aplikasi (Development Mode):
   ```bash
   npm run dev
   ```
5. Atau jalankan di Production Mode:
   ```bash
   npm start
   ```

## Konfigurasi Scheduler

Interval waktu pengiriman data diatur di file `.env` menggunakan format Cron.
```env
# Contoh Cron Expression:
SYNC_CRON=*/15 * * * *  # Setiap 15 menit
SYNC_CRON=0 * * * *     # Setiap 1 jam (tepat di menit ke-0)
```
Jika Anda ingin menonaktifkan pengiriman otomatis dan hanya mengandalkan tombol sinkronisasi manual di web, atur `SYNC_ENABLED=false`.

## Mode Demo

Jika kredensial di file `.env` kosong (belum diisi), aplikasi akan otomatis berjalan dalam **Mode Demo**. Pada mode ini, aplikasi akan menampilkan data dummy/simulasi dan melakukan pengiriman bohongan tanpa menyebabkan error.

## Troubleshooting

- **Logs Docker**: Untuk melihat log sistem yang sedang berjalan:
  ```bash
  docker compose logs -f
  ```
- **Koneksi Gagal**: Periksa URL endpoint di `.env`. BPJS memiliki URL Development (`https://dvlp.bpjs-kesehatan.go.id:8888`) dan Production (`https://new-api.bpjs-kesehatan.go.id`). Pastikan kredensial yang Anda pakai sesuai dengan environment server BPJS.

## Struktur Direktori

```text
.
├── .env.example
├── Dockerfile
├── README.md
├── docker-compose.yml
├── package.json
└── src
    ├── app.js
    ├── models
    │   └── sync-log.model.js
    ├── public
    │   ├── app.js
    │   ├── index.html
    │   └── style.css
    ├── routes
    │   └── api.routes.js
    └── services
        ├── aplicare.service.js
        ├── bridge.service.js
        └── siranap.service.js
```
