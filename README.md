# Ayam Goreng Mitarasa - Mobile POS & Kasir PWA

Aplikasi kasir (Point of Sale) modern berbasis Progressive Web App (PWA) untuk **Ayam Goreng Mitarasa** dengan arsitektur *offline-first* (IndexedDB + Outbox Sync), integrasi Cloud Supabase, serta dukungan Multi-Cabang & harga khusus tiap toko.

## Fitur Unggulan

- ⚡ **Offline-First POS:** Tetap bisa melayani transaksi saat internet putus, otomatis tersinkron saat online kembali via Outbox Queue.
- 🏪 **Multi-Cabang & Lokasi Toko:** Tambah cabang secara Manual atau Impor langsung dari database Presensi Donattour.
- 🏷️ **Penetapan Harga Khusus per Cabang:** Tiap cabang toko bisa memiliki harga jual yang berbeda-beda untuk tiap menu.
- 🔐 **Dual Login Mode:** Login cepat via akun Owner/Admin (Email + Password) atau Login Karyawan/Kasir (Nama + Tanggal Lahir terintegrasi Presensi).
- 🧾 **Format Struk Thermal:** Dukungan printer thermal bluetooth 58mm & 80mm dengan nomor antrean rapi (A-001, dst).
- 📊 **Riwayat & Shift Kasir:** Manajemen buka/tutup kasir, pencatatan kas modal awal, dan rekonsiliasi akhir shift.

---

## Manajemen Database (Drizzle ORM - Development Only)

Sesuai **Addendum Bagian 16** pada PRD, Drizzle ORM digunakan sebagai perkakas pengembang (*development tool*) untuk mendefinisikan skema tabel, menghasilkan migrasi SQL, sinkronisasi skema, dan seeding database. Drizzle ORM, Drizzle Kit, dan postgres terpasang sebagai `devDependencies` dan tidak masuk ke bundle aplikasi browser. Aplikasi browser tetap menggunakan `@supabase/supabase-js` secara lazy import.

### Langkah Penyiapan Database

Ikuti langkah-langkah berikut untuk menyiapkan database Supabase Anda:

1. **Siapkan File Lingkungan (`.env.local`)**
   Salin file `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Buka file `.env.local` lalu isi nilai-nilainya:
   ```env
   # Digunakan oleh aplikasi klien / browser (Vite)
   VITE_SUPABASE_URL=https://<project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>

   # Digunakan khusus untuk perkakas pengembang CLI (Drizzle / scripts)
   DATABASE_URL=postgresql://postgres.<project-id>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
   > **Catatan Keamanan:** `DATABASE_URL` **TIDAK** boleh berawalan `VITE_` dan tidak boleh diakses oleh kode klien browser di luar `src/db` dan `scripts`. File `.env.local` sudah masuk ke `.gitignore`.

2. **Terapkan Skema Database (`db:push`)**
   Jalankan perintah berikut untuk menyinkronkan seluruh skema tabel dari `src/db/schema.ts` ke database Supabase:
   ```bash
   npm run db:push
   ```
   *Alternatif:* Jika ingin menerapkan via file migrasi SQL (termasuk migrasi kustom fungsi `adalah_owner`, RLS policies, RPC `batalkan_pesanan`, dan view `laporan_harian`), jalankan:
   ```bash
   npm run db:migrate
   ```

3. **Isi Data Awal Katalog Menu (`db:seed`)**
   Jalankan script seed untuk memasukkan 4 varian/paket ayam dan 3 item tambahan (add-ons) bawaan dari Bagian 5 PRD:
   ```bash
   npm run db:seed
   ```

---

## Daftar Script NPM Database

| Script | Perintah | Keterangan |
|---|---|---|
| `npm run db:generate` | `drizzle-kit generate` | Menghasilkan berkas migrasi SQL dari skema TypeScript di `src/db/schema.ts`. |
| `npm run db:push` | `drizzle-kit push` | Menerapkan skema tabel Drizzle langsung ke database Postgres Supabase. |
| `npm run db:migrate` | `tsx scripts/migrate.ts` | Mengeksekusi seluruh berkas migrasi pada direktori `./drizzle` ke database. |
| `npm run db:seed` | `tsx scripts/seed.ts` | Mengisi data produk dan tambahan awal dari Bagian 5 PRD. |

---

## Struktur File Database

```
ayamgorengmitarasa/
├─ drizzle.config.ts        # Konfigurasi Drizzle Kit (membaca DATABASE_URL dari .env.local)
├─ drizzle/                 # Berkas migrasi SQL
│  ├─ 0000_curved_marvel_boy.sql  # Dihasilkan dari src/db/schema.ts
│  └─ 0001_rls_and_functions.sql  # Migrasi kustom: RLS, fungsi adalah_owner, RPC, view
├─ scripts/
│  ├─ migrate.ts            # Runner migrasi SQL Drizzle
│  └─ seed.ts               # Script seeding katalog menu dari Bagian 5 PRD
├─ src/
│  ├─ data/
│  │  └─ supabase.ts        # Lazy import @supabase/supabase-js untuk browser
│  └─ db/
│     ├─ index.ts           # Koneksi Drizzle Postgres (khusus scripts/dev tools)
│     └─ schema.ts          # Definisi skema tabel dengan referensi authUsers
├─ .env.example             # Template variabel lingkungan
└─ .gitignore               # Memastikan .env.local tidak ter-commit
```

