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
    return JSON.parse(text);
  } else {
    console.log(`❌ HTTP ${res.status}: ${text.substring(0, 300)}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Menyiapkan skema Multi-Outlet dan Harga per Toko di Supabase...\n');

  // 1. Tabel Outlet
  await runSQL('Tabel outlet', `
    CREATE TABLE IF NOT EXISTS outlet (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kode text NOT NULL UNIQUE,
      nama text NOT NULL,
      alamat text DEFAULT '',
      telepon text DEFAULT '',
      catatan_struk text DEFAULT 'Terima kasih atas kunjungan Anda!',
      aktif boolean DEFAULT true NOT NULL,
      dibuat_pada timestamptz DEFAULT now() NOT NULL,
      diubah_pada timestamptz DEFAULT now() NOT NULL
    );
  `);

  // 2. Tambah kolom outlet_id ke pesanan jika belum ada
  await runSQL('Kolom outlet_id di pesanan', `
    ALTER TABLE pesanan ADD COLUMN IF NOT EXISTS outlet_id uuid;
  `);

  // 3. Tabel harga_produk_outlet
  await runSQL('Tabel harga_produk_outlet', `
    CREATE TABLE IF NOT EXISTS harga_produk_outlet (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      outlet_id uuid NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
      produk_id uuid NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
      harga integer NOT NULL CHECK (harga >= 0),
      aktif boolean DEFAULT true NOT NULL,
      diubah_pada timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT harga_produk_outlet_unique UNIQUE (outlet_id, produk_id)
    );
  `);

  // 4. Tabel harga_tambahan_outlet
  await runSQL('Tabel harga_tambahan_outlet', `
    CREATE TABLE IF NOT EXISTS harga_tambahan_outlet (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      outlet_id uuid NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
      tambahan_id uuid NOT NULL REFERENCES tambahan(id) ON DELETE CASCADE,
      harga integer NOT NULL CHECK (harga >= 0),
      aktif boolean DEFAULT true NOT NULL,
      diubah_pada timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT harga_tambahan_outlet_unique UNIQUE (outlet_id, tambahan_id)
    );
  `);

  // 5. RLS & Policy
  await runSQL('RLS & Policy tabel outlet & harga', `
    ALTER TABLE outlet ENABLE ROW LEVEL SECURITY;
    ALTER TABLE harga_produk_outlet ENABLE ROW LEVEL SECURITY;
    ALTER TABLE harga_tambahan_outlet ENABLE ROW LEVEL SECURITY;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outlet' AND policyname='outlet_public_all') THEN
        CREATE POLICY "outlet_public_all" ON outlet FOR ALL USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='harga_produk_outlet' AND policyname='harga_produk_outlet_public_all') THEN
        CREATE POLICY "harga_produk_outlet_public_all" ON harga_produk_outlet FOR ALL USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='harga_tambahan_outlet' AND policyname='harga_tambahan_outlet_public_all') THEN
        CREATE POLICY "harga_tambahan_outlet_public_all" ON harga_tambahan_outlet FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `);

  // 6. Seed default outlets (Lodan, K3PG, Pusat)
  await runSQL('Seed data outlet default', `
    INSERT INTO outlet (id, kode, nama, alamat, telepon, catatan_struk, aktif)
    VALUES 
      ('925935f0-73a6-4790-9ff9-0dd93aa693b9', 'LODAN', 'Ayam Goreng Mitarasa - Lodan', 'Jl. Lodan No. 12, Gresik', '0812-3456-7891', 'Mitarasa Lodan: Renyah Gurih!', true),
      ('1bd2a51f-8c35-4c53-8693-087facb93492', 'K3PG', 'Ayam Goreng Mitarasa - K3PG', 'Kompleks K3PG, Gresik', '0812-3456-7892', 'Mitarasa K3PG: Nikmat Tiada Tara!', true),
      ('a0000000-0000-0000-0000-000000000001', 'PUSAT', 'Ayam Goreng Mitarasa - Pusat', 'Jl. RA Kartini No. 45, Gresik', '0812-3456-7890', 'Terima kasih atas kunjungan Anda!', true)
    ON CONFLICT (id) DO UPDATE SET
      nama = EXCLUDED.nama,
      kode = EXCLUDED.kode,
      alamat = EXCLUDED.alamat;
  `);

  console.log('\n🎉 Setup Multi-Outlet & Harga per Toko berhasil!');
}

main().catch(console.error);

