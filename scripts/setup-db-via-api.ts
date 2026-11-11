/**
 * Setup database via Supabase Management API
 * Jalankan: npx tsx scripts/setup-db-via-api.ts
 */
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
      'Authorization': `Bearer ${PAT}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (res.ok) {
    console.log('✅');
  } else {
    console.log(`❌ HTTP ${res.status}: ${text.substring(0, 200)}`);
  }
}

async function main() {
  console.log('🚀 Setup database Kasir Mitarasa...\n');

  // ── TABEL ──────────────────────────────────────────────────────────
  console.log('📦 Membuat tabel...');

  await runSQL('profil', `
    CREATE TABLE IF NOT EXISTS profil (
      id uuid PRIMARY KEY NOT NULL,
      nama text NOT NULL,
      peran text DEFAULT 'kasir' NOT NULL,
      dibuat_pada timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT profil_peran_check CHECK (peran in ('owner','kasir'))
    )
  `);

  await runSQL('produk', `
    CREATE TABLE IF NOT EXISTS produk (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      varian text NOT NULL,
      paket text NOT NULL,
      isi text DEFAULT '' NOT NULL,
      harga integer NOT NULL,
      urutan integer DEFAULT 0 NOT NULL,
      aktif boolean DEFAULT true NOT NULL,
      diubah_pada timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT produk_harga_check CHECK (harga >= 0)
    )
  `);

  await runSQL('tambahan', `
    CREATE TABLE IF NOT EXISTS tambahan (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      nama text NOT NULL,
      harga integer NOT NULL,
      urutan integer DEFAULT 0 NOT NULL,
      aktif boolean DEFAULT true NOT NULL,
      diubah_pada timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT tambahan_harga_check CHECK (harga >= 0)
    )
  `);

  await runSQL('shift', `
    CREATE TABLE IF NOT EXISTS shift (
      id uuid PRIMARY KEY NOT NULL,
      kasir_id uuid NOT NULL,
      buka_pada timestamptz NOT NULL,
      tutup_pada timestamptz,
      kas_awal integer DEFAULT 0 NOT NULL,
      kas_akhir integer,
      selisih integer
    )
  `);

  await runSQL('pesanan', `
    CREATE TABLE IF NOT EXISTS pesanan (
      id uuid PRIMARY KEY NOT NULL,
      kode_perangkat text NOT NULL,
      nomor integer NOT NULL,
      tanggal date NOT NULL,
      waktu timestamptz NOT NULL,
      jenis text NOT NULL,
      status text DEFAULT 'selesai' NOT NULL,
      metode text NOT NULL,
      total integer NOT NULL,
      bayar integer NOT NULL,
      kembalian integer DEFAULT 0 NOT NULL,
      catatan text,
      alasan_batal text,
      shift_id uuid,
      kasir_id uuid NOT NULL,
      CONSTRAINT pesanan_tanggal_kode_perangkat_nomor_key UNIQUE(tanggal,kode_perangkat,nomor),
      CONSTRAINT pesanan_jenis_check CHECK (jenis in ('makan_di_tempat','bawa_pulang')),
      CONSTRAINT pesanan_status_check CHECK (status in ('selesai','batal')),
      CONSTRAINT pesanan_metode_check CHECK (metode in ('tunai','qris')),
      CONSTRAINT pesanan_total_check CHECK (total >= 0),
      CONSTRAINT pesanan_bayar_check CHECK (bayar >= 0)
    )
  `);

  await runSQL('item_pesanan', `
    CREATE TABLE IF NOT EXISTS item_pesanan (
      id uuid PRIMARY KEY NOT NULL,
      pesanan_id uuid NOT NULL,
      produk_id uuid NOT NULL,
      nama_produk text NOT NULL,
      qty integer NOT NULL,
      harga_satuan integer NOT NULL,
      tambahan jsonb DEFAULT '[]'::jsonb NOT NULL,
      CONSTRAINT item_pesanan_qty_check CHECK (qty > 0)
    )
  `);

  await runSQL('log_audit', `
    CREATE TABLE IF NOT EXISTS log_audit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      waktu timestamptz DEFAULT now() NOT NULL,
      pengguna_id uuid,
      aksi text NOT NULL,
      detail jsonb
    )
  `);

  // ── FOREIGN KEY ────────────────────────────────────────────────────
  console.log('\n🔗 Menambahkan foreign key...');
  await runSQL('FK semua tabel', `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profil_id_users_id_fk') THEN
        ALTER TABLE profil ADD CONSTRAINT profil_id_users_id_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shift_kasir_id_profil_id_fk') THEN
        ALTER TABLE shift ADD CONSTRAINT shift_kasir_id_profil_id_fk FOREIGN KEY (kasir_id) REFERENCES profil(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pesanan_shift_id_shift_id_fk') THEN
        ALTER TABLE pesanan ADD CONSTRAINT pesanan_shift_id_shift_id_fk FOREIGN KEY (shift_id) REFERENCES shift(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pesanan_kasir_id_profil_id_fk') THEN
        ALTER TABLE pesanan ADD CONSTRAINT pesanan_kasir_id_profil_id_fk FOREIGN KEY (kasir_id) REFERENCES profil(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_pesanan_pesanan_id_pesanan_id_fk') THEN
        ALTER TABLE item_pesanan ADD CONSTRAINT item_pesanan_pesanan_id_pesanan_id_fk FOREIGN KEY (pesanan_id) REFERENCES pesanan(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_pesanan_produk_id_produk_id_fk') THEN
        ALTER TABLE item_pesanan ADD CONSTRAINT item_pesanan_produk_id_produk_id_fk FOREIGN KEY (produk_id) REFERENCES produk(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='log_audit_pengguna_id_profil_id_fk') THEN
        ALTER TABLE log_audit ADD CONSTRAINT log_audit_pengguna_id_profil_id_fk FOREIGN KEY (pengguna_id) REFERENCES profil(id);
      END IF;
    END $$
  `);

  // ── INDEX ──────────────────────────────────────────────────────────
  console.log('\n📇 Membuat index...');
  await runSQL('index pesanan_tanggal', `CREATE INDEX IF NOT EXISTS pesanan_tanggal_idx ON pesanan USING btree (tanggal)`);
  await runSQL('index item_pesanan_id', `CREATE INDEX IF NOT EXISTS item_pesanan_pesanan_id_idx ON item_pesanan USING btree (pesanan_id)`);

  // ── FUNGSI & RLS ───────────────────────────────────────────────────
  console.log('\n🔒 Fungsi & RLS...');
  await runSQL('fungsi adalah_owner()', `
    CREATE OR REPLACE FUNCTION public.adalah_owner()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (SELECT 1 FROM public.profil WHERE id = auth.uid() AND peran = 'owner');
    $$
  `);

  await runSQL('enable RLS semua tabel', `
    ALTER TABLE public.profil ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.produk ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.tambahan ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.shift ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.pesanan ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.item_pesanan ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.log_audit ENABLE ROW LEVEL SECURITY;
  `);

  await runSQL('policies semua tabel', `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='profil: baca sendiri atau owner' AND tablename='profil') THEN
        CREATE POLICY "profil: baca sendiri atau owner" ON public.profil FOR SELECT USING (id = auth.uid() OR public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='profil: owner kelola' AND tablename='profil') THEN
        CREATE POLICY "profil: owner kelola" ON public.profil FOR ALL USING (public.adalah_owner()) WITH CHECK (public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='produk: semua login boleh baca' AND tablename='produk') THEN
        CREATE POLICY "produk: semua login boleh baca" ON public.produk FOR SELECT USING (auth.role() = 'authenticated');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='produk: owner kelola' AND tablename='produk') THEN
        CREATE POLICY "produk: owner kelola" ON public.produk FOR ALL USING (public.adalah_owner()) WITH CHECK (public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='tambahan: semua login boleh baca' AND tablename='tambahan') THEN
        CREATE POLICY "tambahan: semua login boleh baca" ON public.tambahan FOR SELECT USING (auth.role() = 'authenticated');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='tambahan: owner kelola' AND tablename='tambahan') THEN
        CREATE POLICY "tambahan: owner kelola" ON public.tambahan FOR ALL USING (public.adalah_owner()) WITH CHECK (public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='shift: kasir kelola miliknya' AND tablename='shift') THEN
        CREATE POLICY "shift: kasir kelola miliknya" ON public.shift FOR ALL USING (kasir_id = auth.uid() OR public.adalah_owner()) WITH CHECK (kasir_id = auth.uid() OR public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='pesanan: kasir baca dan buat miliknya' AND tablename='pesanan') THEN
        CREATE POLICY "pesanan: kasir baca dan buat miliknya" ON public.pesanan FOR SELECT USING (kasir_id = auth.uid() OR public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='pesanan: kasir insert miliknya' AND tablename='pesanan') THEN
        CREATE POLICY "pesanan: kasir insert miliknya" ON public.pesanan FOR INSERT WITH CHECK (kasir_id = auth.uid() OR public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='pesanan: owner ubah' AND tablename='pesanan') THEN
        CREATE POLICY "pesanan: owner ubah" ON public.pesanan FOR UPDATE USING (public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='item: ikut pesanan (baca)' AND tablename='item_pesanan') THEN
        CREATE POLICY "item: ikut pesanan (baca)" ON public.item_pesanan FOR SELECT USING (EXISTS (SELECT 1 FROM public.pesanan p WHERE p.id = pesanan_id AND (p.kasir_id = auth.uid() OR public.adalah_owner())));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='item: ikut pesanan (insert)' AND tablename='item_pesanan') THEN
        CREATE POLICY "item: ikut pesanan (insert)" ON public.item_pesanan FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.pesanan p WHERE p.id = pesanan_id AND (p.kasir_id = auth.uid() OR public.adalah_owner())));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='audit: owner baca' AND tablename='log_audit') THEN
        CREATE POLICY "audit: owner baca" ON public.log_audit FOR SELECT USING (public.adalah_owner());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='audit: login boleh tulis' AND tablename='log_audit') THEN
        CREATE POLICY "audit: login boleh tulis" ON public.log_audit FOR INSERT WITH CHECK (auth.role() = 'authenticated');
      END IF;
    END $$
  `);

  // ── RPC & VIEW ─────────────────────────────────────────────────────
  console.log('\n⚙️  RPC & View...');
  await runSQL('RPC batalkan_pesanan()', `
    CREATE OR REPLACE FUNCTION public.batalkan_pesanan(p_id uuid, p_alasan text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF coalesce(trim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan pembatalan wajib diisi'; END IF;
      UPDATE public.pesanan SET status = 'batal', alasan_batal = p_alasan
      WHERE id = p_id AND (kasir_id = auth.uid() OR public.adalah_owner()) AND status = 'selesai';
      INSERT INTO public.log_audit (pengguna_id, aksi, detail)
      VALUES (auth.uid(), 'batal_pesanan', jsonb_build_object('pesanan_id', p_id, 'alasan', p_alasan));
    END $$
  `);

  await runSQL('view laporan_harian', `
    CREATE OR REPLACE VIEW public.laporan_harian WITH (security_invoker = true) AS
    SELECT tanggal,
      count(*) FILTER (WHERE status = 'selesai') AS jumlah_pesanan,
      coalesce(sum(total) FILTER (WHERE status = 'selesai'), 0) AS omzet,
      coalesce(sum(total) FILTER (WHERE status = 'selesai' AND metode = 'tunai'), 0) AS total_tunai,
      coalesce(sum(total) FILTER (WHERE status = 'selesai' AND metode = 'qris'), 0) AS total_qris,
      count(*) FILTER (WHERE status = 'batal') AS jumlah_batal
    FROM public.pesanan GROUP BY tanggal
  `);

  // ── SEED DATA ──────────────────────────────────────────────────────
  console.log('\n🌱 Seed data menu...');
  await runSQL('produk (4 item)', `
    INSERT INTO public.produk (varian, paket, isi, harga, urutan, aktif) VALUES
      ('Original','Paket 1','1 pcs ayam + nasi + teh',15000,1,true),
      ('Original','Paket 2','2 pcs ayam + nasi + teh',25000,2,true),
      ('Spicy','Paket 1','1 pcs ayam pedas + nasi + teh',17000,3,true),
      ('Spicy','Paket 2','2 pcs ayam pedas + nasi + teh',28000,4,true)
    ON CONFLICT DO NOTHING
  `);

  await runSQL('tambahan (3 item)', `
    INSERT INTO public.tambahan (nama, harga, urutan, aktif) VALUES
      ('Nasi Tambah',5000,1,true),
      ('Es Teh Manis',5000,2,true),
      ('Sambal Extra',2000,3,true)
    ON CONFLICT DO NOTHING
  `);

  console.log('\n✅ Setup database selesai!');
  console.log('👉 Cek di: https://supabase.com/dashboard/project/dgnpcutgnmrsyjaspgwj/editor');
}

main().catch(console.error);
