import { signal } from '@preact/signals';

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
  qrisImage?: string; // Preview foto QRIS toko
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
 * Simpan konfigurasi pecahan uang tunai
 */
export function simpanKonfigurasiTunai(cfg: KonfigurasiTunai): void {
  const bersih: KonfigurasiTunai = {
    pecahanCepat: Array.from(new Set(cfg.pecahanCepat.filter((n) => n > 0))).sort((a, b) => a - b),
    tampilkanUangPas: cfg.tampilkanUangPas ?? true,
  };
  localStorage.setItem(KUNCI_STORAGE_TUNAI, JSON.stringify(bersih));
  konfigurasiTunaiSignal.value = bersih;
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
  if (!outletId) return null;
  const semua = muatSemuaQrisOutlet();
  return semua[outletId] || null;
}

/**
 * Simpan konfigurasi QRIS statis untuk cabang tertentu
 */
export function simpanQrisOutlet(cfg: KonfigurasiQrisOutlet): void {
  const semua = muatSemuaQrisOutlet();
  semua[cfg.outletId] = {
    ...cfg,
    diubahPada: new Date().toISOString(),
  };
  localStorage.setItem(KUNCI_STORAGE_QRIS, JSON.stringify(semua));
  daftarQrisOutletSignal.value = { ...semua };
}

/**
 * Hapus data QRIS untuk cabang tertentu
 */
export function hapusQrisOutlet(outletId: string): void {
  const semua = muatSemuaQrisOutlet();
  delete semua[outletId];
  localStorage.setItem(KUNCI_STORAGE_QRIS, JSON.stringify(semua));
  daftarQrisOutletSignal.value = { ...semua };
}


/**
 * Urutan tombol nominal tunai di kasir: semua pecahan yang disimpan (selain yang sama dengan total),
 * unik, dari terkecil ke terbesar. 'Uang Pas' selalu ditaruh paling kiri oleh tampilan.
 */
export function urutkanPecahanKasir(pecahan: number[], total: number): number[] {
  return Array.from(new Set(pecahan.filter((n) => n > 0 && n !== total))).sort((a, b) => a - b);
}
