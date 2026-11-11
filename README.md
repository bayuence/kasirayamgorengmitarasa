# Ayam Goreng Mitarasa - Mobile POS

Aplikasi kasir (Point of Sale) modern berbasis Progressive Web App (PWA) untuk **Ayam Goreng Mitarasa**. Dirancang khusus untuk kemudahan operasional kasir di perangkat mobile, mendukung multi-cabang toko, penetapan harga khusus per lokasi, serta keandalan transaksi offline-first.

## Fitur Utama

- **Kasir (POS):** Antarmuka pemesanan cepat (Makan di Tempat & Bawa Pulang), pilihan varian menu, dan item tambahan (add-ons).
- **Offline-First:** Transaksi tetap berjalan lancar saat koneksi internet terputus dan otomatis tersinkronisasi kembali saat online.
- **Multi-Cabang & Lokasi Toko:** Pengelolaan cabang toko secara fleksibel, baik melalui input manual maupun impor langsung dari sistem Presensi.
- **Harga Khusus per Toko:** Fleksibilitas menetapkan harga jual menu yang berbeda untuk masing-masing cabang toko.
- **Format Struk & Printer Thermal:** Cetak nota transaksi dengan nomor antrean rapi, mendukung printer thermal bluetooth 58mm dan 80mm.
- **Manajemen Shift & Riwayat:** Pencatatan modal kas awal, rekonsiliasi kas akhir shift, dan pelacakan riwayat transaksi.
- **Side Menu & Profil Akun:** Navigasi administrasi lengkap untuk katalog produk, cabang, struk, dan data divisi akun pengguna.

## Teknologi

- **Frontend:** Preact, TypeScript, Vite
- **Penyimpanan Lokal & PWA:** IndexedDB (`idb`), Service Worker PWA
- **Cloud Backend:** Supabase (Database & Realtime Sync)
