-- ============================================================
-- SCRIPT UPDATE DATABASE SUPABASE — KASIR MITARASA
-- Jalankan skrip ini di SQL Editor Supabase Anda:
-- https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- 1. Tambah kolom gambar & kategori ke tabel produk jika belum ada
ALTER TABLE public.produk ADD COLUMN IF NOT EXISTS "gambar" text;
ALTER TABLE public.produk ADD COLUMN IF NOT EXISTS "kategori" text DEFAULT 'Paket Ayam';
ALTER TABLE public.produk ADD COLUMN IF NOT EXISTS "kategori_id" text;
ALTER TABLE public.produk ADD COLUMN IF NOT EXISTS "hpp" integer DEFAULT 0;

-- 2. Buat tabel kategori menu jika belum ada
CREATE TABLE IF NOT EXISTS public.kategori (
  "id" text PRIMARY KEY NOT NULL,
  "nama" text NOT NULL,
  "urutan" integer DEFAULT 0 NOT NULL,
  "aktif" boolean DEFAULT true NOT NULL,
  "diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Buat tabel outlet / cabang toko jika belum ada
CREATE TABLE IF NOT EXISTS public.outlet (
  "id" text PRIMARY KEY NOT NULL,
  "kode" text DEFAULT '',
  "nama" text NOT NULL,
  "alamat" text DEFAULT '',
  "telepon" text DEFAULT '',
  "catatan_struk" text DEFAULT 'Terima kasih atas kunjungan Anda!',
  "aktif" boolean DEFAULT true NOT NULL,
  "sumber" text DEFAULT 'manual',
  "presensi_location_id" text,
  "qris_payload" text,
  "qris_merchant_name" text,
  "qris_merchant_city" text,
  "qris_image" text,
  "diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Buat tabel pengaturan_toko untuk sinkronisasi QRIS, pecahan kasir, dan preferensi toko
CREATE TABLE IF NOT EXISTS public.pengaturan_toko (
  "kunci" text PRIMARY KEY NOT NULL,
  "nilai" jsonb NOT NULL,
  "diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. Tambah kolom tanggal, kasir_nama, rincian detail ke tabel shift jika belum ada
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "tanggal" date DEFAULT CURRENT_DATE;
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "kasir_nama" text;
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "total_tunai" integer DEFAULT 0;
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "total_qris" integer DEFAULT 0;
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "jumlah_pesanan" integer DEFAULT 0;
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "catatan" text;
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "sumber_dana" text DEFAULT 'Tim Keuangan';
ALTER TABLE public.shift ADD COLUMN IF NOT EXISTS "rincian_pecahan" jsonb;

-- 5. Aktifkan Row Level Security (RLS)
ALTER TABLE public.kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengaturan_toko ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tambahan ENABLE ROW LEVEL SECURITY;

-- 6. Pasang Kebijakan Akses (Policy) agar Kasir & Owner dapat sinkron tanpa hambatan
DROP POLICY IF EXISTS "kategori: semua boleh baca" ON public.kategori;
CREATE POLICY "kategori: semua boleh baca" ON public.kategori FOR SELECT USING (true);
DROP POLICY IF EXISTS "kategori: kelola" ON public.kategori;
CREATE POLICY "kategori: kelola" ON public.kategori FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "outlet: semua boleh baca" ON public.outlet;
CREATE POLICY "outlet: semua boleh baca" ON public.outlet FOR SELECT USING (true);
DROP POLICY IF EXISTS "outlet: kelola" ON public.outlet;
CREATE POLICY "outlet: kelola" ON public.outlet FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pengaturan: semua boleh baca" ON public.pengaturan_toko;
CREATE POLICY "pengaturan: semua boleh baca" ON public.pengaturan_toko FOR SELECT USING (true);
DROP POLICY IF EXISTS "pengaturan: kelola" ON public.pengaturan_toko;
CREATE POLICY "pengaturan: kelola" ON public.pengaturan_toko FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "produk: semua login boleh baca" ON public.produk;
DROP POLICY IF EXISTS "produk: semua boleh baca" ON public.produk;
CREATE POLICY "produk: semua boleh baca" ON public.produk FOR SELECT USING (true);
DROP POLICY IF EXISTS "produk: kelola" ON public.produk;
CREATE POLICY "produk: kelola" ON public.produk FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tambahan: semua login boleh baca" ON public.tambahan;
DROP POLICY IF EXISTS "tambahan: semua boleh baca" ON public.tambahan;
CREATE POLICY "tambahan: semua boleh baca" ON public.tambahan FOR SELECT USING (true);
DROP POLICY IF EXISTS "tambahan: kelola" ON public.tambahan;
CREATE POLICY "tambahan: kelola" ON public.tambahan FOR ALL USING (true) WITH CHECK (true);

-- 7. Masukkan Kategori Bawaan jika masih kosong
INSERT INTO public.kategori (id, nama, urutan, aktif)
VALUES
  ('kat-1', 'Paket Ayam', 1, true),
  ('kat-2', 'Ala Carte', 2, true),
  ('kat-3', 'Minuman', 3, true),
  ('kat-4', 'Camilan', 4, true)
ON CONFLICT (id) DO NOTHING;
