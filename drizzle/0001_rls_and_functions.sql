-- Fungsi verifikasi owner
CREATE OR REPLACE FUNCTION public.adalah_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profil WHERE id = auth.uid() AND peran = 'owner');
$$;
--> statement-breakpoint

-- Enable Row Level Security (RLS)
ALTER TABLE public.profil ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.produk ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tambahan ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.shift ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.pesanan ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.item_pesanan ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.log_audit ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- RLS Policies: profil
CREATE POLICY "profil: baca sendiri atau owner" ON public.profil
  FOR SELECT USING (id = auth.uid() OR public.adalah_owner());
--> statement-breakpoint
CREATE POLICY "profil: owner kelola" ON public.profil
  FOR ALL USING (public.adalah_owner()) WITH CHECK (public.adalah_owner());
--> statement-breakpoint

-- RLS Policies: produk
CREATE POLICY "produk: semua login boleh baca" ON public.produk
  FOR SELECT USING (auth.role() = 'authenticated');
--> statement-breakpoint
CREATE POLICY "produk: owner kelola" ON public.produk
  FOR ALL USING (public.adalah_owner()) WITH CHECK (public.adalah_owner());
--> statement-breakpoint

-- RLS Policies: tambahan
CREATE POLICY "tambahan: semua login boleh baca" ON public.tambahan
  FOR SELECT USING (auth.role() = 'authenticated');
--> statement-breakpoint
CREATE POLICY "tambahan: owner kelola" ON public.tambahan
  FOR ALL USING (public.adalah_owner()) WITH CHECK (public.adalah_owner());
--> statement-breakpoint

-- RLS Policies: shift
CREATE POLICY "shift: kasir kelola miliknya" ON public.shift
  FOR ALL USING (kasir_id = auth.uid() OR public.adalah_owner())
  WITH CHECK (kasir_id = auth.uid() OR public.adalah_owner());
--> statement-breakpoint

-- RLS Policies: pesanan
CREATE POLICY "pesanan: kasir baca dan buat miliknya" ON public.pesanan
  FOR SELECT USING (kasir_id = auth.uid() OR public.adalah_owner());
--> statement-breakpoint
CREATE POLICY "pesanan: kasir insert miliknya" ON public.pesanan
  FOR INSERT WITH CHECK (kasir_id = auth.uid() OR public.adalah_owner());
--> statement-breakpoint
CREATE POLICY "pesanan: owner ubah" ON public.pesanan
  FOR UPDATE USING (public.adalah_owner());
--> statement-breakpoint

-- RLS Policies: item_pesanan
CREATE POLICY "item: ikut pesanan (baca)" ON public.item_pesanan
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.pesanan p WHERE p.id = pesanan_id
    AND (p.kasir_id = auth.uid() OR public.adalah_owner())));
--> statement-breakpoint
CREATE POLICY "item: ikut pesanan (insert)" ON public.item_pesanan
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.pesanan p WHERE p.id = pesanan_id
    AND (p.kasir_id = auth.uid() OR public.adalah_owner())));
--> statement-breakpoint

-- RLS Policies: log_audit
CREATE POLICY "audit: owner baca" ON public.log_audit
  FOR SELECT USING (public.adalah_owner());
--> statement-breakpoint
CREATE POLICY "audit: login boleh tulis" ON public.log_audit
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
--> statement-breakpoint

-- RPC pembatalan pesanan (audit log otomatis)
CREATE OR REPLACE FUNCTION public.batalkan_pesanan(p_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(trim(p_alasan), '') = '' THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi';
  END IF;
  UPDATE public.pesanan SET status = 'batal', alasan_batal = p_alasan
  WHERE id = p_id AND (kasir_id = auth.uid() OR public.adalah_owner()) AND status = 'selesai';
  INSERT INTO public.log_audit (pengguna_id, aksi, detail)
  VALUES (auth.uid(), 'batal_pesanan', jsonb_build_object('pesanan_id', p_id, 'alasan', p_alasan));
END $$;
--> statement-breakpoint

-- View laporan harian
CREATE OR REPLACE VIEW public.laporan_harian WITH (security_invoker = true) AS
SELECT tanggal,
       count(*) FILTER (WHERE status = 'selesai') AS jumlah_pesanan,
       coalesce(sum(total) FILTER (WHERE status = 'selesai'), 0) AS omzet,
       coalesce(sum(total) FILTER (WHERE status = 'selesai' AND metode = 'tunai'), 0) AS total_tunai,
       coalesce(sum(total) FILTER (WHERE status = 'selesai' AND metode = 'qris'), 0) AS total_qris,
       count(*) FILTER (WHERE status = 'batal') AS jumlah_batal
FROM public.pesanan GROUP BY tanggal;
