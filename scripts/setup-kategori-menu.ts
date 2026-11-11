import { config } from 'dotenv';
config({ path: '.env.local' });

const PAT = process.env.SUPABASE_ACCESS_TOKEN || '';
const PROJECT_REF = 'dgnpcutgnmrsyjaspgwj';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runSQL(label: string, sql: string) {
  process.stdout.write(`  ${label}... `);
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PAT}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (res.ok) {
    console.log('✅');
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } else {
    console.log(`❌ HTTP ${res.status}: ${text.substring(0, 300)}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Menyiapkan skema Kategori & Detail Menu (HPP, Margin, Gambar)...');

  // 1. Buat tabel kategori
  await runSQL('Tabel kategori', `
    CREATE TABLE IF NOT EXISTS kategori (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nama text NOT NULL UNIQUE,
      urutan integer DEFAULT 0 NOT NULL,
      aktif boolean DEFAULT true NOT NULL,
      dibuat_pada timestamptz DEFAULT now() NOT NULL,
      diubah_pada timestamptz DEFAULT now() NOT NULL
    );
  `);

  // 2. Tambah kolom ke tabel produk jika belum ada:
  // - hpp (Harga Pokok Penjualan / Modal)
  // - gambar (URL atau base64 gambar)
  // - kategori_id (uuid nullable)
  // - kategori (text default 'Paket Ayam')
  await runSQL('Kolom hpp di produk', `
    ALTER TABLE produk ADD COLUMN IF NOT EXISTS hpp integer DEFAULT 0 NOT NULL;
  `);
  await runSQL('Kolom gambar di produk', `
    ALTER TABLE produk ADD COLUMN IF NOT EXISTS gambar text DEFAULT '';
  `);
  await runSQL('Kolom kategori_id di produk', `
    ALTER TABLE produk ADD COLUMN IF NOT EXISTS kategori_id uuid REFERENCES kategori(id) ON DELETE SET NULL;
  `);
  await runSQL('Kolom kategori di produk', `
    ALTER TABLE produk ADD COLUMN IF NOT EXISTS kategori text DEFAULT 'Paket Ayam';
  `);

  // 3. Tambah kolom hpp di harga_produk_outlet jika ada kebutuhan HPP khusus per outlet
  await runSQL('Kolom hpp di harga_produk_outlet', `
    ALTER TABLE harga_produk_outlet ADD COLUMN IF NOT EXISTS hpp integer;
  `);

  // 4. Masukkan kategori bawaan jika tabel kategori kosong
  await runSQL('Kategori bawaan', `
    INSERT INTO kategori (nama, urutan, aktif)
    VALUES 
      ('Paket Ayam', 1, true),
      ('Ala Carte / Satuan', 2, true),
      ('Minuman', 3, true),
      ('Tambahan & Sambal', 4, true)
    ON CONFLICT (nama) DO NOTHING;
  `);

  // 5. Update kategori produk yang ada jika masih kosong
  await runSQL('Update kategori produk lama', `
    UPDATE produk 
    SET 
      kategori = CASE 
        WHEN varian ILIKE '%ayam%' OR paket ILIKE '%paket%' THEN 'Paket Ayam'
        WHEN varian ILIKE '%minum%' OR paket ILIKE '%es%' OR paket ILIKE '%teh%' THEN 'Minuman'
        ELSE 'Paket Ayam'
      END,
      hpp = CASE
        WHEN hpp = 0 AND harga > 0 THEN ROUND(harga * 0.6)
        ELSE hpp
      END
    WHERE kategori IS NULL OR hpp = 0;
  `);

  // Hubungkan kategori_id di produk dengan id dari tabel kategori
  await runSQL('Relasikan kategori_id di produk', `
    UPDATE produk p
    SET kategori_id = k.id
    FROM kategori k
    WHERE p.kategori = k.nama AND (p.kategori_id IS NULL);
  `);

  await runSQL('RLS kategori', `
    ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Akses kategori untuk semua" ON kategori;
    CREATE POLICY "Akses kategori untuk semua" ON kategori FOR ALL USING (true) WITH CHECK (true);
  `);

  console.log('\n✨ Skema Kategori & Menu selesai disiapkan!');
}

main().catch(console.error);
