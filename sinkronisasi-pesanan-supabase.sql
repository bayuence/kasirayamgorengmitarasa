-- ============================================================
-- SCRIPT MENGAKTIFKAN SINKRONISASI REALTIME LENGKAP KE SUPABASE
-- Jalankan skrip ini di SQL Editor Supabase Anda:
-- https://supabase.com/dashboard/project/dkkgncgioenbrkzqqekn/sql/new
-- ============================================================

-- 1. Tambah kolom ke tabel pesanan
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS "outlet_id" text;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS "kode_transaksi" text;
ALTER TABLE public.pesanan ALTER COLUMN "kasir_id" DROP NOT NULL;

-- 2. Lepaskan foreign key yang membatasi pengiriman data kasir / produk
ALTER TABLE public.pesanan DROP CONSTRAINT IF EXISTS "pesanan_kasir_id_profil_id_fk";
ALTER TABLE public.pesanan DROP CONSTRAINT IF EXISTS "pesanan_shift_id_shift_id_fk";
ALTER TABLE public.item_pesanan DROP CONSTRAINT IF EXISTS "item_pesanan_produk_id_produk_id_fk";

-- 3. Ubah tipe kolom produk_id pada item_pesanan menjadi text (agar menerima id string seperti 'prod-1' atau uuid)
ALTER TABLE public.item_pesanan ALTER COLUMN "produk_id" TYPE text USING "produk_id"::text;

-- 4. Aktifkan RLS & pasang Policy terbuka untuk pesanan & item_pesanan
ALTER TABLE public.pesanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_pesanan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pesanan: semua boleh baca" ON public.pesanan;
CREATE POLICY "pesanan: semua boleh baca" ON public.pesanan FOR SELECT USING (true);

DROP POLICY IF EXISTS "pesanan: kelola" ON public.pesanan;
CREATE POLICY "pesanan: kelola" ON public.pesanan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "item_pesanan: semua boleh baca" ON public.item_pesanan;
CREATE POLICY "item_pesanan: semua boleh baca" ON public.item_pesanan FOR SELECT USING (true);

DROP POLICY IF EXISTS "item_pesanan: kelola" ON public.item_pesanan;
CREATE POLICY "item_pesanan: kelola" ON public.item_pesanan FOR ALL USING (true) WITH CHECK (true);

-- 5. Buat tabel pengeluaran jika belum ada
CREATE TABLE IF NOT EXISTS public.pengeluaran (
  "id" text PRIMARY KEY NOT NULL,
  "outlet_id" text NOT NULL,
  "tanggal" text NOT NULL,
  "kategori" text NOT NULL,
  "nominal" numeric NOT NULL,
  "keterangan" text,
  "bukti_foto" text,
  "kasir_nama" text,
  "dibuat_pada" text NOT NULL
);

ALTER TABLE public.pengeluaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pengeluaran: semua boleh baca" ON public.pengeluaran;
CREATE POLICY "pengeluaran: semua boleh baca" ON public.pengeluaran FOR SELECT USING (true);

DROP POLICY IF EXISTS "pengeluaran: kelola" ON public.pengeluaran;
CREATE POLICY "pengeluaran: kelola" ON public.pengeluaran FOR ALL USING (true) WITH CHECK (true);
