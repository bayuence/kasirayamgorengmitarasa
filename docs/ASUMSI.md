# Catatan Asumsi Teknis dan Bisnis: Aplikasi Kasir Mitarasa

Dokumen ini mencatat asumsi yang diambil selama perancangan dan pembangunan aplikasi kasir Mitarasa (PWA + Supabase).

## 1. Asumsi Bisnis & Operasional
1. **Tambahan Menu (Add-ons):**
   - Tambahan (Upgrade nasi daun jeruk, Extra kremes, Extra sambel) berlaku umum untuk semua varian produk (Ayam Rempah Jawa dan Ayam Goreng Bawang Putih).
2. **Perangkat dan Kasir:**
   - Toko dijalankan dengan 1 sampai 3 kasir / perangkat. Setiap perangkat memiliki `kode_perangkat` unik (misal: 'A', 'B', 'C') untuk menjamin penomoran antrean harian tidak bentrok.
3. **Pencetakan Struk:**
   - Belum menggunakan printer thermal Bluetooth dedicated. Pencetakan menggunakan dialog print bawaan browser (`window.print()` dengan CSS `@media print` 58 mm) atau dibagikan via Web Share API / salin teks ke clipboard.
4. **Pajak dan Biaya Layanan:**
   - Harga menu sudah netto (tidak ada pajak pertambahan nilai maupun service charge terpisah).

## 2. Asumsi Teknis & Dependensi
1. **Pustaka Runtime Klien:**
   - Klien browser hanya menggunakan pustaka resmi yang diizinkan: `preact`, `@preact/signals`, `idb`, `@supabase/supabase-js` (di-load secara dinamis/lazy), serta `vite-plugin-pwa` untuk service worker & caching.
   - Tidak menggunakan library CSS eksternal (Tailwind/Bootstrap/MUI) maupun library ikon/font web eksternal demi mematuhi batasan ukuran awal (JS awal ≤ 60 KB gzip, CSS ≤ 10 KB gzip).
2. **Pustaka Development-Only (Drizzle ORM):**
   - Berdasarkan Addendum Bagian 16 PRD, `drizzle-orm`, `drizzle-kit`, `postgres`, `tsx`, dan `dotenv` dipasang khusus sebagai `devDependencies` untuk migrasi, sinkronisasi skema, dan seeding data menu awal.
   - Pustaka-pustaka Drizzle ini tidak diikutsertakan ke dalam bundle browser ataupun dipanggil dari kode front-end.
3. **Kunci Layanan & Autentikasi:**
   - Klien browser hanya menggunakan `VITE_SUPABASE_ANON_KEY`.
   - `DATABASE_URL` (direct postgres connection) tidak boleh terekspos ke klien browser dan diisolasi di file `.env.local` yang masuk ke `.gitignore`.

