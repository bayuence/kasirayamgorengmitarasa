import { signal } from '@preact/signals';
import { getSupabase } from './supabase.js';

/**
 * Pengaturan Pembayaran (Tunai & QRIS Dinamis)
 */

export interface KonfigurasiTunai {
  pecahanCepat: number[];
  tampilkanUangPas: boolean;
}

export interface KonfigurasiQrisOutlet {
  outletId: string;
  outletNama: string;
  qrisPayload: string; // Payload EMVCo asli dari QRIS statis
  merchantName?: string;
  merchantCity?: string;
  qrisImage?: string; // Preview foto QRIS toko (terkompresi ringan)
  diubahPada: string;
}

const KUNCI_STORAGE_TUNAI = 'mitarasa_cfg_tunai_v1';
const KUNCI_STORAGE_QRIS = 'mitarasa_cfg_qris_outlet_v1';

const DEFAULT_TUNAI: KonfigurasiTunai = {
  pecahanCepat: [10000, 20000, 50000, 100000],
  tampilkanUangPas: true,
};

export const konfigurasiTunaiSignal = signal<KonfigurasiTunai>(muatKonfigurasiTunai());
export const daftarQrisOutletSignal = signal<Record<string, KonfigurasiQrisOutlet>>(muatSemuaQrisOutlet());

/**
 * Muat konfigurasi pecahan uang tunai
 */
export function muatKonfigurasiTunai(): KonfigurasiTunai {
  try {
    const raw = localStorage.getItem(KUNCI_STORAGE_TUNAI);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.pecahanCepat) && parsed.pecahanCepat.length > 0) {
        return {
          pecahanCepat: parsed.pecahanCepat.sort((a: number, b: number) => a - b),
          tampilkanUangPas: parsed.tampilkanUangPas ?? true,
        };
      }
    }
  } catch {}
  return DEFAULT_TUNAI;
}

/**
 * Simpan konfigurasi pecahan uang tunai (ke LocalStorage & Cloud Supabase)
 */
export async function simpanKonfigurasiTunai(cfg: KonfigurasiTunai): Promise<void> {
  const bersih: KonfigurasiTunai = {
    pecahanCepat: Array.from(new Set(cfg.pecahanCepat.filter((n) => n > 0))).sort((a, b) => a - b),
    tampilkanUangPas: cfg.tampilkanUangPas ?? true,
  };
  localStorage.setItem(KUNCI_STORAGE_TUNAI, JSON.stringify(bersih));
  konfigurasiTunaiSignal.value = bersih;

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('pengaturan_toko').upsert({
        kunci: KUNCI_STORAGE_TUNAI,
        nilai: bersih,
        diubah_pada: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Gagal sinkron konfigurasi tunai ke Supabase:', e);
    }
  }
}

/**
 * Muat seluruh data QRIS toko dari penyimpanan lokal
 */
export function muatSemuaQrisOutlet(): Record<string, KonfigurasiQrisOutlet> {
  try {
    const raw = localStorage.getItem(KUNCI_STORAGE_QRIS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

/**
 * Ambil data QRIS spesifik untuk satu outlet/cabang
 */
export function muatQrisOutlet(outletId?: string | null): KonfigurasiQrisOutlet | null {
  const semua = muatSemuaQrisOutlet();
  if (outletId && semua[outletId]) return semua[outletId];
  if (semua['utama']) return semua['utama'];
  // Fallback: jika outletId tidak cocok / belum dipilih, gunakan QRIS yang sudah tersimpan
  const keys = Object.keys(semua);
  if (keys.length > 0) {
    return semua[keys[0]];
  }
  return null;
}

/**
 * Simpan konfigurasi QRIS statis untuk cabang tertentu (ke LocalStorage & Cloud Supabase)
 */
export async function simpanQrisOutlet(cfg: KonfigurasiQrisOutlet): Promise<void> {
  const semua = muatSemuaQrisOutlet();
  semua[cfg.outletId] = {
    ...cfg,
    diubahPada: new Date().toISOString(),
  };
  localStorage.setItem(KUNCI_STORAGE_QRIS, JSON.stringify(semua));
  daftarQrisOutletSignal.value = { ...semua };

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      // 1. Simpan ke tabel pengaturan_toko agar aman dan tersinkron ke semua perangkat
      await supabase.from('pengaturan_toko').upsert({
        kunci: KUNCI_STORAGE_QRIS,
        nilai: semua,
        diubah_pada: new Date().toISOString(),
      });

      // 2. Jika bukan outletId 'utama', sinkronkan juga ke tabel outlet
      if (cfg.outletId && cfg.outletId !== 'utama') {
        await supabase
          .from('outlet')
          .update({
            qris_payload: cfg.qrisPayload,
            qris_merchant_name: cfg.merchantName || cfg.outletNama,
            qris_merchant_city: cfg.merchantCity || 'Indonesia',
            qris_image: cfg.qrisImage || '',
            diubah_pada: new Date().toISOString(),
          })
          .eq('id', cfg.outletId);
      }
    } catch (e) {
      console.warn('Gagal sinkron konfigurasi QRIS ke Supabase:', e);
    }
  }
}

/**
 * Hapus data QRIS untuk cabang tertentu (dari LocalStorage & Cloud Supabase)
 */
export async function hapusQrisOutlet(outletId: string): Promise<void> {
  const semua = muatSemuaQrisOutlet();
  delete semua[outletId];
  localStorage.setItem(KUNCI_STORAGE_QRIS, JSON.stringify(semua));
  daftarQrisOutletSignal.value = { ...semua };

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('pengaturan_toko').upsert({
        kunci: KUNCI_STORAGE_QRIS,
        nilai: semua,
        diubah_pada: new Date().toISOString(),
      });

      if (outletId && outletId !== 'utama') {
        await supabase
          .from('outlet')
          .update({
            qris_payload: null,
            qris_merchant_name: null,
            qris_merchant_city: null,
            qris_image: null,
            diubah_pada: new Date().toISOString(),
          })
          .eq('id', outletId);
      }
    } catch (e) {
      console.warn('Gagal hapus konfigurasi QRIS dari Supabase:', e);
    }
  }
}

/**
 * Sinkronkan pengaturan pembayaran (QRIS & Tunai) dari Supabase ke browser
 */
export async function sinkronkanPembayaranDariSupabase(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('pengaturan_toko')
      .select('kunci, nilai')
      .in('kunci', [KUNCI_STORAGE_QRIS, KUNCI_STORAGE_TUNAI]);

    if (!error && data && data.length > 0) {
      for (const item of data) {
        if (item.kunci === KUNCI_STORAGE_QRIS && item.nilai) {
          localStorage.setItem(KUNCI_STORAGE_QRIS, JSON.stringify(item.nilai));
          daftarQrisOutletSignal.value = { ...item.nilai };
        } else if (item.kunci === KUNCI_STORAGE_TUNAI && item.nilai) {
          localStorage.setItem(KUNCI_STORAGE_TUNAI, JSON.stringify(item.nilai));
          konfigurasiTunaiSignal.value = { ...item.nilai };
        }
      }
    }
  } catch (err) {
    console.warn('Gagal sinkron pembayaran dari Supabase:', err);
  }
}

/**
 * Urutan tombol nominal tunai di kasir: semua pecahan yang disimpan (selain yang sama dengan total),
 * unik, dari terkecil ke terbesar. 'Uang Pas' selalu ditaruh paling kiri oleh tampilan.
 */
export function urutkanPecahanKasir(pecahan: number[], total: number): number[] {
  return Array.from(new Set(pecahan.filter((n) => n > 0 && n !== total))).sort((a, b) => a - b);
}
