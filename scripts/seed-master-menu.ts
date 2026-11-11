import { config } from 'dotenv';
config({ path: '.env.local' });

const PAT = process.env.SUPABASE_ACCESS_TOKEN || '';
const PROJECT_REF = 'dgnpcutgnmrsyjaspgwj';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function main() {
  const sql = `
    ALTER TABLE produk ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tambahan ENABLE ROW LEVEL SECURITY;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='produk' AND policyname='produk_public_all') THEN
        CREATE POLICY "produk_public_all" ON produk FOR ALL USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tambahan' AND policyname='tambahan_public_all') THEN
        CREATE POLICY "tambahan_public_all" ON tambahan FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;

    INSERT INTO produk (id, varian, paket, isi, harga, urutan, aktif)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'Ayam Rempah Jawa', 'Reguler', 'Nasi, ayam, sambel, lalapan', 18000, 1, true),
      ('22222222-2222-2222-2222-222222222222', 'Ayam Rempah Jawa', 'Komplit', 'Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu', 25000, 2, true),
      ('33333333-3333-3333-3333-333333333333', 'Ayam Goreng Bawang Putih', 'Reguler', 'Nasi, ayam, sambel, lalapan', 18000, 3, true),
      ('44444444-4444-4444-4444-444444444444', 'Ayam Goreng Bawang Putih', 'Komplit', 'Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu', 25000, 4, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tambahan (id, nama, harga, urutan, aktif)
    VALUES
      ('55555555-5555-5555-5555-555555555555', 'Upgrade nasi daun jeruk', 2000, 1, true),
      ('66666666-6666-6666-6666-666666666666', 'Extra kremes', 5000, 2, true),
      ('77777777-7777-7777-7777-777777777777', 'Extra sambel', 5000, 3, true)
    ON CONFLICT (id) DO NOTHING;
  `;

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  console.log('Result:', res.status, text.substring(0, 100));
}

main().catch(console.error);

