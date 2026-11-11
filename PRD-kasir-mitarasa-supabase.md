# PRD: Aplikasi Kasir Mitarasa (PWA + Supabase)

> Instruksi untuk AI coding agent: bangun proyek ini mengikuti dokumen ini secara berurutan sesuai bagian "Urutan pengerjaan". Jangan menambah fitur di luar bagian "Ruang lingkup MVP". Jika ada hal yang ambigu, ambil asumsi paling sederhana dan catat di `docs/ASUMSI.md`.

## 1. Ringkasan

Aplikasi kasir berbasis mobile web (PWA) untuk toko makanan **Mitarasa** yang menjual dua varian ayam: **Ayam Rempah Jawa** dan **Ayam Goreng Bawang Putih**. Kasir mencatat pesanan dari HP Android, aplikasi menghitung total dan kembalian, menyimpan transaksi, dan pemilik melihat laporan harian.

Prinsip utama:
- **Cepat dan ringan.** Muat awal sangat kecil, interaksi instan.
- **Offline-first.** Kasir tidak boleh berhenti bekerja saat internet putus. Data ditulis ke perangkat dulu, lalu disinkronkan ke Supabase saat online.
- **Sederhana.** Satu toko, satu sampai tiga kasir.

## 2. Aturan wajib (constraints)

1. Framework: **Preact + Vite + TypeScript**. Tidak memakai React penuh, Next.js, Angular, atau UI library (MUI, Bootstrap, Tailwind, dsb).
2. Gaya: **CSS murni** (file `.css` biasa dengan CSS variables, flexbox, grid). Dilarang memakai library ikon, emoji, atau gambar ikon. Tombol dan status memakai **label teks** dan bentuk CSS. Tombol jumlah memakai karakter `+` dan `−`.
3. Font: **font sistem** (`system-ui`), tanpa web font. Angka harga memakai `font-variant-numeric: tabular-nums`.
4. Backend: **Supabase** (Auth, Postgres, RLS). Klien hanya memakai `anon key`. **Jangan pernah** menaruh `service_role` key di kode klien.
5. `@supabase/supabase-js` **wajib di-load lazy** (`import()` dinamis) setelah aplikasi tampil, supaya bundle awal tetap kecil.
6. Anggaran ukuran: JS awal (di luar chunk supabase) **≤ 60 KB gzip**, CSS **≤ 10 KB gzip**.
7. Target sentuh minimal 48 px. Kontras teks minimal 4,5:1. Fokus keyboard terlihat.
8. Semua teks antarmuka berbahasa Indonesia, kalimat sentence case, kata kerja aktif ("Bayar", "Tutup shift", "Batalkan pesanan").
9. Tema terang dan gelap otomatis (`prefers-color-scheme`) lewat CSS variables.
10. Desain bersih dan modern: ruang kosong lega, garis tipis, sudut membulat sedang, hampir tanpa bayangan, tanpa gradien dekoratif, tanpa animasi dekoratif.

## 3. Pengguna

| Peran | Kebutuhan |
|---|---|
| `kasir` | Input pesanan cepat, bayar, cetak/bagikan struk, lihat riwayat hari ini, buka/tutup shift. Tidak boleh mengubah menu dan harga. |
| `owner` | Semua akses kasir, plus kelola menu dan harga, laporan, ekspor data, kelola akun kasir. |

## 4. Ruang lingkup MVP

Termasuk:
- Login (Supabase Auth) + kunci layar PIN lokal
- Katalog menu dan tambahan (data bawaan, bisa diubah owner)
- Keranjang, catatan, jenis pesanan (makan di tempat / bawa pulang)
- Pembayaran tunai (kembalian otomatis) dan QRIS manual (ditandai lunas)
- Struk (cetak 58 mm lewat browser + bagikan teks)
- Riwayat hari ini dan pembatalan (alasan wajib, tercatat di log audit)
- Buka dan tutup shift (kas awal, kas akhir, selisih)
- Laporan harian dan ekspor CSV
- PWA installable, berjalan offline, sinkronisasi ke Supabase

Tidak termasuk (jangan dibuat): payment gateway, pajak/akuntansi, printer Bluetooth, diskon/promo, stok bahan, data pelanggan, aplikasi native.

## 5. Data menu awal (seed)

Produk:

| varian | paket | isi | harga (Rp) |
|---|---|---|---|
| Ayam Rempah Jawa | Reguler | Nasi, ayam, sambel, lalapan | 18000 |
| Ayam Rempah Jawa | Komplit | Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu | 25000 |
| Ayam Goreng Bawang Putih | Reguler | Nasi, ayam, sambel, lalapan | 18000 |
| Ayam Goreng Bawang Putih | Komplit | Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu | 25000 |

Tambahan:

| nama | harga (Rp) |
|---|---|
| Upgrade nasi daun jeruk | 2000 |
| Extra kremes | 5000 |
| Extra sambel | 5000 |

Asumsi: tambahan berlaku untuk kedua varian (poster Rempah Jawa tidak mencantumkannya). Catat di `docs/ASUMSI.md`.

## 6. Alur kasir

1. **Masuk.** Login email dan password sekali (sesi disimpan). Selanjutnya cukup PIN 4 digit untuk membuka kunci layar, otomatis terkunci setelah 5 menit tidak aktif.
2. **Buka shift.** Isi kas awal laci.
3. **Pilih menu.** Tab varian di atas, daftar paket dengan stepper `−` `jumlah` `+`. Chip tambahan di bawah item.
4. **Catatan dan jenis pesanan.** Default jenis pesanan mengikuti pilihan terakhir.
5. **Bayar.** Tunai: input nominal atau tombol cepat (Uang pas, 20 rb, 50 rb, 100 rb), kembalian tampil besar. QRIS: tombol "Tandai lunas".
6. **Struk.** Tombol "Cetak" dan "Bagikan".
7. **Tutup shift.** Input uang fisik, tampilkan selisih terhadap total tunai tercatat.

Target: satu pesanan sederhana selesai ≤ 15 detik, 3 sampai 4 ketukan.

## 7. Kebutuhan fungsional

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| F1 | Login Supabase Auth (email+password), sesi tersimpan, kunci layar PIN lokal | Wajib |
| F2 | Layar kasir muat tanpa scroll berlebihan di lebar 360 px | Wajib |
| F3 | Keranjang: tambah, kurangi, hapus, tambahan per item, catatan per pesanan, undo hapus | Wajib |
| F4 | Bayar tunai + kembalian + tombol nominal cepat | Wajib |
| F5 | Bayar QRIS manual, metode tersimpan di laporan | Penting |
| F6 | Nomor antrean harian otomatis (lihat bagian 9) | Wajib |
| F7 | Struk 58 mm (`@media print`) dan bagikan teks (Web Share API, fallback salin) | Penting |
| F8 | Riwayat hari ini, cari nomor, batalkan pesanan dengan alasan wajib | Wajib |
| F9 | Buka/tutup shift dengan kas awal, kas akhir, selisih | Penting |
| F10 | Laporan harian: omzet, jumlah pesanan, per varian dan paket, tambahan terlaris, tunai vs QRIS, grafik batang dengan CSS | Wajib |
| F11 | Kelola menu dan harga (owner): tambah, ubah, nonaktifkan; transaksi lama tidak berubah | Wajib |
| F12 | Ekspor laporan CSV dan cadangan JSON | Penting |
| F13 | PWA: manifest, ikon aplikasi (gambar file PNG untuk manifest saja), mode standalone | Wajib |
| F14 | Sinkronisasi dua arah dengan Supabase (lihat bagian 9) | Wajib |
| F15 | Indikator status sinkron berupa teks kecil: "Tersinkron", "Menunggu sinkron (3)", "Offline" | Wajib |

## 8. Skema database Supabase

Jalankan di SQL Editor Supabase. Semua `id` dibuat di klien (`crypto.randomUUID()`) agar aman dipakai offline.

```sql
-- Profil pengguna dan peran
create table public.profil (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  peran text not null check (peran in ('owner','kasir')) default 'kasir',
  dibuat_pada timestamptz not null default now()
);

create or replace function public.adalah_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profil where id = auth.uid() and peran = 'owner');
$$;

create table public.produk (
  id uuid primary key default gen_random_uuid(),
  varian text not null,
  paket text not null,
  isi text not null default '',
  harga integer not null check (harga >= 0),
  urutan integer not null default 0,
  aktif boolean not null default true,
  diubah_pada timestamptz not null default now()
);

create table public.tambahan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  harga integer not null check (harga >= 0),
  urutan integer not null default 0,
  aktif boolean not null default true,
  diubah_pada timestamptz not null default now()
);

create table public.shift (
  id uuid primary key,
  kasir_id uuid not null references public.profil(id),
  buka_pada timestamptz not null,
  tutup_pada timestamptz,
  kas_awal integer not null default 0,
  kas_akhir integer,
  selisih integer
);

create table public.pesanan (
  id uuid primary key,
  kode_perangkat text not null,           -- contoh: 'A'
  nomor integer not null,                 -- urut harian per perangkat
  tanggal date not null,                  -- tanggal lokal toko
  waktu timestamptz not null,
  jenis text not null check (jenis in ('makan_di_tempat','bawa_pulang')),
  status text not null check (status in ('selesai','batal')) default 'selesai',
  metode text not null check (metode in ('tunai','qris')),
  total integer not null check (total >= 0),
  bayar integer not null check (bayar >= 0),
  kembalian integer not null default 0,
  catatan text,
  alasan_batal text,
  shift_id uuid references public.shift(id),
  kasir_id uuid not null references public.profil(id),
  unique (tanggal, kode_perangkat, nomor)
);

create table public.item_pesanan (
  id uuid primary key,
  pesanan_id uuid not null references public.pesanan(id) on delete cascade,
  produk_id uuid not null references public.produk(id),
  nama_produk text not null,              -- snapshot
  qty integer not null check (qty > 0),
  harga_satuan integer not null,          -- snapshot
  tambahan jsonb not null default '[]'    -- [{"nama":"Extra kremes","harga":5000,"qty":1}]
);

create table public.log_audit (
  id uuid primary key default gen_random_uuid(),
  waktu timestamptz not null default now(),
  pengguna_id uuid references public.profil(id),
  aksi text not null,
  detail jsonb
);

create index on public.pesanan (tanggal);
create index on public.item_pesanan (pesanan_id);

-- RLS
alter table public.profil enable row level security;
alter table public.produk enable row level security;
alter table public.tambahan enable row level security;
alter table public.shift enable row level security;
alter table public.pesanan enable row level security;
alter table public.item_pesanan enable row level security;
alter table public.log_audit enable row level security;

create policy "profil: baca sendiri atau owner" on public.profil
  for select using (id = auth.uid() or public.adalah_owner());
create policy "profil: owner kelola" on public.profil
  for all using (public.adalah_owner()) with check (public.adalah_owner());

create policy "produk: semua login boleh baca" on public.produk
  for select using (auth.role() = 'authenticated');
create policy "produk: owner kelola" on public.produk
  for all using (public.adalah_owner()) with check (public.adalah_owner());

create policy "tambahan: semua login boleh baca" on public.tambahan
  for select using (auth.role() = 'authenticated');
create policy "tambahan: owner kelola" on public.tambahan
  for all using (public.adalah_owner()) with check (public.adalah_owner());

create policy "shift: kasir kelola miliknya" on public.shift
  for all using (kasir_id = auth.uid() or public.adalah_owner())
  with check (kasir_id = auth.uid() or public.adalah_owner());

create policy "pesanan: kasir baca dan buat miliknya" on public.pesanan
  for select using (kasir_id = auth.uid() or public.adalah_owner());
create policy "pesanan: kasir insert miliknya" on public.pesanan
  for insert with check (kasir_id = auth.uid() or public.adalah_owner());
create policy "pesanan: owner ubah" on public.pesanan
  for update using (public.adalah_owner());

create policy "item: ikut pesanan (baca)" on public.item_pesanan
  for select using (exists (select 1 from public.pesanan p where p.id = pesanan_id
    and (p.kasir_id = auth.uid() or public.adalah_owner())));
create policy "item: ikut pesanan (insert)" on public.item_pesanan
  for insert with check (exists (select 1 from public.pesanan p where p.id = pesanan_id
    and (p.kasir_id = auth.uid() or public.adalah_owner())));

create policy "audit: owner baca" on public.log_audit
  for select using (public.adalah_owner());
create policy "audit: login boleh tulis" on public.log_audit
  for insert with check (auth.role() = 'authenticated');

-- Pembatalan oleh kasir lewat fungsi (tercatat di audit)
create or replace function public.batalkan_pesanan(p_id uuid, p_alasan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan pembatalan wajib diisi';
  end if;
  update public.pesanan set status = 'batal', alasan_batal = p_alasan
  where id = p_id and (kasir_id = auth.uid() or public.adalah_owner()) and status = 'selesai';
  insert into public.log_audit (pengguna_id, aksi, detail)
  values (auth.uid(), 'batal_pesanan', jsonb_build_object('pesanan_id', p_id, 'alasan', p_alasan));
end $$;

-- Ringkasan harian untuk laporan
create or replace view public.laporan_harian with (security_invoker = true) as
select tanggal,
       count(*) filter (where status = 'selesai') as jumlah_pesanan,
       coalesce(sum(total) filter (where status = 'selesai'), 0) as omzet,
       coalesce(sum(total) filter (where status = 'selesai' and metode = 'tunai'), 0) as total_tunai,
       coalesce(sum(total) filter (where status = 'selesai' and metode = 'qris'), 0) as total_qris,
       count(*) filter (where status = 'batal') as jumlah_batal
from public.pesanan group by tanggal;

-- Seed menu
insert into public.produk (varian, paket, isi, harga, urutan) values
 ('Ayam Rempah Jawa','Reguler','Nasi, ayam, sambel, lalapan',18000,1),
 ('Ayam Rempah Jawa','Komplit','Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu',25000,2),
 ('Ayam Goreng Bawang Putih','Reguler','Nasi, ayam, sambel, lalapan',18000,3),
 ('Ayam Goreng Bawang Putih','Komplit','Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu',25000,4);
insert into public.tambahan (nama, harga, urutan) values
 ('Upgrade nasi daun jeruk',2000,1),('Extra kremes',5000,2),('Extra sambel',5000,3);
```

Setelah akun pertama dibuat lewat Supabase Auth, jadikan owner:
```sql
insert into public.profil (id, nama, peran) values ('<UUID_USER_AUTH>', 'Pemilik', 'owner');
```
Tambahkan trigger opsional agar akun baru otomatis masuk `profil` dengan peran `kasir`.

## 9. Strategi offline dan sinkronisasi

Penyimpanan lokal: **IndexedDB** lewat pustaka `idb`. Store: `produk`, `tambahan`, `pesanan`, `item_pesanan`, `shift`, `outbox`, `meta`.

**Menulis (kasir → server).**
1. Setiap transaksi (shift, pesanan, item) ditulis ke IndexedDB dan satu entri ke `outbox` dalam satu transaksi IndexedDB.
2. Saat online (event `online`, saat aplikasi dibuka, dan interval 30 detik), proses `outbox` berurutan memakai `upsert` dengan `id` klien, sehingga aman diulang (idempoten).
3. Entri `outbox` dihapus hanya setelah server membalas sukses. Jika gagal, coba ulang dengan jeda bertahap (5 dtk, 15 dtk, 60 dtk).

**Membaca (server → kasir).** Saat online, tarik `produk` dan `tambahan` yang `diubah_pada` lebih baru dari catatan terakhir di `meta`, simpan ke IndexedDB. Layar kasir selalu membaca dari IndexedDB.

**Nomor antrean.** Setiap perangkat punya `kode_perangkat` (huruf, diatur sekali di pengaturan). `nomor` adalah penghitung harian lokal yang reset saat `tanggal` berganti. Tampilkan sebagai `A-012`. Batas unik `(tanggal, kode_perangkat, nomor)` mencegah bentrok antar perangkat.

**Laporan.** Owner membaca view `laporan_harian` saat online. Saat offline, hitung dari IndexedDB perangkat ini dan tampilkan label "Data perangkat ini".

**Pembatalan.** Saat online panggil RPC `batalkan_pesanan`. Saat offline, tandai lokal dan masukkan ke `outbox` sebagai aksi `batal`.

**Auth offline.** Sesi Supabase disimpan di perangkat. Aplikasi tetap bisa dipakai saat token kedaluwarsa dan offline. Segarkan token saat kembali online. Jika refresh gagal karena akun dinonaktifkan, paksa login ulang setelah outbox terkirim.

## 10. Struktur proyek yang diminta

```
mitarasa-kasir/
├─ index.html
├─ vite.config.ts            # plugin preact + vite-plugin-pwa
├─ .env.example              # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├─ supabase/
│  └─ schema.sql             # isi bagian 8
├─ docs/ASUMSI.md
├─ public/
│  ├─ icon-192.png  icon-512.png  icon-maskable-512.png
└─ src/
   ├─ main.tsx
   ├─ app.tsx                # router sederhana berbasis hash
   ├─ styles/
   │  ├─ tokens.css          # CSS variables terang/gelap
   │  ├─ base.css
   │  └─ komponen.css
   ├─ data/
   │  ├─ db.ts               # idb
   │  ├─ outbox.ts           # antrean sinkron
   │  └─ supabase.ts         # lazy import klien
   ├─ state/                 # @preact/signals
   │  ├─ keranjang.ts  sesi.ts  sinkron.ts
   ├─ fitur/
   │  ├─ kasir/  bayar/  riwayat/  laporan/  shift/  pengaturan/  login/
   └─ util/
      ├─ rupiah.ts           # Intl.NumberFormat('id-ID')
      └─ struk.ts
```

Pustaka yang boleh dipakai: `preact`, `@preact/signals`, `idb`, `@supabase/supabase-js` (lazy), `vite-plugin-pwa`. Pustaka lain perlu alasan tertulis di `docs/ASUMSI.md`.

## 11. Arah desain

Token warna (variabel CSS, terang):

| token | nilai |
|---|---|
| `--bg` | `#f6f7f3` |
| `--surface` | `#ffffff` |
| `--ink` | `#18221b` |
| `--muted` | `#5b665e` |
| `--line` | `#dfe3da` |
| `--brand` | `#1f4d36` |
| `--soft` | `#e8efe6` |
| `--accent` | `#b36b12` |

Tema gelap: `--bg #0f1511`, `--surface #161e19`, `--ink #e8ede9`, `--muted #9aa89f`, `--line #27322b`, `--brand #7fc29a`, `--soft #1b2a21`, `--accent #e0a050`.

Aturan tampilan:
- Satu aksi utama per layar: tombol `--brand` lebar penuh di bawah, dalam jangkauan ibu jari.
- Layar kasir: tab varian (segmented control), kartu paket dengan nama, isi singkat, harga, stepper. Chip tambahan di bawah kartu terpilih. Bilah keranjang melekat di bawah dengan jumlah item, jenis pesanan, dan total.
- Layar bayar: ringkasan pesanan, pilihan metode (dua tombol teks), input nominal, kembalian dengan huruf besar.
- Grafik laporan: batang horizontal dari `div` dengan lebar persen.
- Status sinkron: teks kecil di header, titik berwarna dari CSS (`::before` berbentuk lingkaran).
- Gerak hanya sebagai respons ketukan (perubahan angka jumlah). Hormati `prefers-reduced-motion`.

## 12. Kebutuhan non-fungsional

- Muat pertama di 4G ≤ 1,5 detik, kunjungan berikutnya ≤ 0,5 detik (dari cache service worker).
- Lighthouse: Performance ≥ 95, PWA lulus kriteria installable.
- Perangkat target: Android 8+, RAM 2 GB, Chrome terbaru, lebar 360 sampai 1024 px. iOS didukung sebagai sekunder.
- Service worker: precache app shell, strategi cache-first untuk aset, banner "Versi baru tersedia, muat ulang" yang tidak memotong transaksi berjalan.
- Keamanan: RLS aktif di semua tabel, PIN lokal disimpan sebagai hash (PBKDF2 via Web Crypto), log audit untuk pembatalan dan perubahan harga.
- Cadangan: tombol ekspor JSON seluruh data lokal.

## 13. Urutan pengerjaan (milestone)

Kerjakan berurutan. Setiap milestone selesai jika kriteria penerimaannya lolos.

**M1. Fondasi.** Inisialisasi Vite + Preact + TS, `tokens.css`, PWA (manifest + service worker), IndexedDB, router hash, halaman kosong tiap layar.
Penerimaan: bisa di-install, terbuka saat offline, ukuran JS awal tercatat.

**M2. Supabase dan auth.** Jalankan `supabase/schema.sql`, klien lazy, login, tarik menu ke IndexedDB, kunci layar PIN.
Penerimaan: menu tampil dari IndexedDB setelah login, tetap tampil saat offline.

**M3. Layar kasir dan keranjang.** Tab varian, stepper, tambahan, catatan, jenis pesanan, bilah total.
Penerimaan: pesanan 2 item + 1 tambahan selesai dalam ≤ 4 ketukan, total benar.

**M4. Bayar, struk, nomor antrean.** Tunai dan QRIS, kembalian, struk cetak dan bagikan, simpan ke IndexedDB + `outbox`.
Penerimaan: transaksi tersimpan lokal saat offline dan tampil di riwayat.

**M5. Sinkronisasi.** Proses `outbox`, upsert idempoten, indikator status, tarik pembaruan menu.
Penerimaan: matikan internet, buat 3 pesanan, nyalakan internet, ketiganya muncul di Supabase tepat sekali.

**M6. Riwayat, pembatalan, shift.** Daftar hari ini, RPC `batalkan_pesanan`, buka/tutup shift dengan selisih.
Penerimaan: pembatalan tanpa alasan ditolak, tercatat di `log_audit`.

**M7. Laporan dan pengaturan.** `laporan_harian`, ringkasan per varian dan paket, kelola menu dan harga (owner), ekspor CSV/JSON.
Penerimaan: kasir tidak bisa membuka pengaturan menu, perubahan harga tidak mengubah pesanan lama.

**M8. Penyelesaian.** Uji di Android RAM 2 GB, audit Lighthouse, perbaiki kontras dan fokus, tulis `README.md` (cara menjalankan, env, deploy ke Vercel/Netlify/Cloudflare Pages).
Penerimaan: semua target di bagian 12 tercapai.

## 14. Risiko

| Risiko | Penanganan |
|---|---|
| Data lokal hilang karena browser dibersihkan | Sinkron rutin ke Supabase + tombol ekspor JSON + pengingat saat tutup shift |
| Bundle melebihi anggaran karena supabase-js | Lazy import, periksa ukuran tiap build (`vite build` + analisis) |
| Bentrok nomor antrean antar perangkat | `kode_perangkat` + batas unik harian |
| Salah ketuk saat ramai | Undo di keranjang, konfirmasi hanya untuk aksi yang tidak bisa dibatalkan |
| iOS membatasi penyimpanan PWA | Rekomendasikan Android sebagai perangkat kasir utama |

## 15. Pertanyaan terbuka (catat sebagai asumsi jika belum terjawab)

1. Tambahan berlaku untuk kedua varian? (Asumsi: ya)
2. Berapa kasir dan perangkat? (Asumsi: 1 sampai 3)
3. Printer struk yang dipakai? (Asumsi: belum ada, cetak lewat browser)
4. Ada pajak atau biaya layanan? (Asumsi: tidak)


## 16. Addendum: Manajemen Database dengan Drizzle ORM (Development Only)

> **PENTING:** Addendum ini memiliki prioritas tertinggi dan menang jika bertentangan dengan ketentuan sebelumnya di dalam PRD.

### 16.1 Ketentuan Penggunaan Drizzle ORM
1. **Khusus Development:** Drizzle ORM digunakan semata-mata sebagai perangkat perkakas pengembang (development-only tool) untuk manajemen skema, migrasi, dan seeding database Supabase/PostgreSQL.
2. **Ketergantungan (Dependencies):** Pustaka `drizzle-orm`, `drizzle-kit`, dan driver `postgres` dipasang sebagai `devDependencies`. Paket-paket ini **TIDAK BOLEH** masuk atau diimpor ke dalam bundle kode klien/browser.
3. **Klien Browser:** Aplikasi di browser tetap memakai `@supabase/supabase-js` (dengan lazy dynamic import) untuk membaca dan menulis data atau memanggil RPC. Drizzle tidak dipakai sama sekali di dalam kode browser.

### 16.2 Skema Database (`src/db/schema.ts`)
- Semua tabel dari Bagian 8 PRD didefinisikan secara deklaratif di `src/db/schema.ts` menggunakan TypeScript dan helper Postgres dari `drizzle-orm/pg-core`.
- Referensi foreign key ke tabel `auth.users` menggunakan skema bawaan `authUsers` dari `drizzle-orm/supabase`.
- Tabel yang didefinisikan:
  - `profil` (`public.profil`): id (`uuid` PK references `auth.users.id` on delete cascade), `nama` (`text`), `peran` (`text` check `peran in ('owner','kasir')` default `'kasir'`), `dibuat_pada` (`timestamptz` default `now()`).
  - `produk` (`public.produk`): `id` (`uuid` PK default `gen_random_uuid()`), `varian` (`text`), `paket` (`text`), `isi` (`text` default `''`), `harga` (`integer` check `harga >= 0`), `urutan` (`integer` default `0`), `aktif` (`boolean` default `true`), `diubah_pada` (`timestamptz` default `now()`).
  - `tambahan` (`public.tambahan`): `id` (`uuid` PK default `gen_random_uuid()`), `nama` (`text`), `harga` (`integer` check `harga >= 0`), `urutan` (`integer` default `0`), `aktif` (`boolean` default `true`), `diubah_pada` (`timestamptz` default `now()`).
  - `shift` (`public.shift`): `id` (`uuid` PK), `kasir_id` (`uuid` references `public.profil.id`), `buka_pada` (`timestamptz`), `tutup_pada` (`timestamptz`), `kas_awal` (`integer` default `0`), `kas_akhir` (`integer`), `selisih` (`integer`).
  - `pesanan` (`public.pesanan`): `id` (`uuid` PK), `kode_perangkat` (`text`), `nomor` (`integer`), `tanggal` (`date`), `waktu` (`timestamptz`), `jenis` (`text` check `jenis in ('makan_di_tempat','bawa_pulang')`), `status` (`text` check `status in ('selesai','batal')` default `'selesai'`), `metode` (`text` check `metode in ('tunai','qris')`), `total` (`integer` check `total >= 0`), `bayar` (`integer` check `bayar >= 0`), `kembalian` (`integer` default `0`), `catatan` (`text`), `alasan_batal` (`text`), `shift_id` (`uuid` references `public.shift.id`), `kasir_id` (`uuid` references `public.profil.id`), unique `(tanggal, kode_perangkat, nomor)`, index pada `tanggal`.
  - `item_pesanan` (`public.item_pesanan`): `id` (`uuid` PK), `pesanan_id` (`uuid` references `public.pesanan.id` on delete cascade), `produk_id` (`uuid` references `public.produk.id`), `nama_produk` (`text`), `qty` (`integer` check `qty > 0`), `harga_satuan` (`integer`), `tambahan` (`jsonb` default `'[]'`), index pada `pesanan_id`.
  - `log_audit` (`public.log_audit`): `id` (`uuid` PK default `gen_random_uuid()`), `waktu` (`timestamptz` default `now()`), `pengguna_id` (`uuid` references `public.profil.id`), `aksi` (`text`), `detail` (`jsonb`).

### 16.3 Konfigurasi Drizzle & Variabel Lingkungan
- `drizzle.config.ts`: membaca variabel lingkungan `DATABASE_URL` dari `.env.local`.
- Batasan Keamanan: `DATABASE_URL` **TIDAK BOLEH** berawalan `VITE_` dan **TIDAK BOLEH** dibaca oleh kode di folder `src` selain `src/db` dan `scripts`.
- Template `.env.example`: berisi `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, dan `DATABASE_URL` (dengan nilai kosong).
- File `.env.local` wajib dimasukkan ke dalam `.gitignore`.

### 16.4 Objek Database Lanjutan (Custom Migration)
Bagian yang tidak didukung atau tidak cocok di Drizzle ORM deklaratif:
- Fungsi `public.adalah_owner()`
- RLS policy lengkap untuk seluruh tabel
- RPC fungsi `public.batalkan_pesanan(p_id uuid, p_alasan text)`
- View `public.laporan_harian`
Dikelola sebagai file migrasi SQL kustom lewat `drizzle-kit generate --custom`, dengan kode SQL diambil dari Bagian 8 PRD.

### 16.5 Script NPM
Disediakan script npm:
- `db:generate`: menjalankan `drizzle-kit generate`
- `db:push`: menjalankan `drizzle-kit push`
- `db:migrate`: menjalankan migrator database untuk mengeksekusi berkas migrasi SQL
- `db:seed`: mengeksekusi script pengisian data menu dan tambahan awal dari Bagian 5 PRD

### 16.6 Alur Penyiapan Database
Terdokumentasi pada `README.md`:
1. Buat file `.env.local` dari `.env.example` dan isi `DATABASE_URL`.
2. Jalankan `npm run db:push` untuk sinkronisasi skema tabel.
3. Jalankan `npm run db:seed` untuk memasukkan data menu awal.
