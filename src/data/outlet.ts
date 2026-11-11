import { signal } from '@preact/signals';
import { getLocalDB, type OutletItem, type HargaProdukOutletItem } from './db.js';
import { getSupabase } from './supabase.js';
import { muatDaftarLokasiPresensi } from './presensi.js';

export interface ProfilOutletLokal {
  kodePerangkat: string;
  pesanFooter: string;
  ukuranKertas: '58mm' | '80mm';
}

// Signal outlet yang sedang aktif di perangkat ini (null jika belum ada toko yang dibuat)
export const outletAktifSignal = signal<OutletItem | null>(null);

/**
 * Inisialisasi outlet aktif dari penyimpanan lokal
 */
export function inisialisasiOutletAktif(): OutletItem | null {
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem('mitarasa_profil_outlet');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.id && parsed.namaToko) {
        const item: OutletItem = {
          id: parsed.id,
          kode: parsed.kode || '',
          nama: parsed.namaToko || parsed.nama || 'Ayam Goreng Mitarasa',
          alamat: parsed.alamat || '',
          telepon: parsed.telepon || '',
          catatan_struk: parsed.pesanFooter || 'Terima kasih atas kunjungan Anda!',
          aktif: true,
          sumber: parsed.sumber || 'manual',
          presensi_location_id: parsed.presensi_location_id || null,
          diubah_pada: new Date().toISOString(),
        };
        outletAktifSignal.value = item;
        return item;
      }
    } catch {}
  }

  outletAktifSignal.value = null;
  return null;
}

/**
 * Set outlet aktif untuk perangkat kasir ini
 */
export function pilihOutletAktif(outlet: OutletItem): void {
  outletAktifSignal.value = outlet;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mitarasa_outlet_aktif_id', outlet.id);
    const legacy = {
      id: outlet.id,
      kode: outlet.kode,
      namaToko: outlet.nama,
      alamat: outlet.alamat,
      telepon: outlet.telepon,
      pesanFooter: outlet.catatan_struk,
      sumber: outlet.sumber || 'manual',
      presensi_location_id: outlet.presensi_location_id || null,
      kodePerangkat: localStorage.getItem('mitarasa_kode_perangkat') || 'A',
      ukuranKertas: '58mm',
    };
    localStorage.setItem('mitarasa_profil_outlet', JSON.stringify(legacy));
  }
}

/**
 * Profil struk kasir
 */
export function getProfilOutlet(): {
  id: string;
  kode: string;
  namaToko: string;
  alamat: string;
  telepon: string;
  sumber?: 'manual' | 'presensi';
  kodePerangkat: string;
  pesanFooter: string;
  ukuranKertas: '58mm' | '80mm';
} {
  const current = outletAktifSignal.value || inisialisasiOutletAktif();
  let kodePerangkat = 'A';
  let ukuranKertas: '58mm' | '80mm' = '58mm';

  if (typeof localStorage !== 'undefined') {
    kodePerangkat = localStorage.getItem('mitarasa_kode_perangkat') || 'A';
    const raw = localStorage.getItem('mitarasa_profil_outlet');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.ukuranKertas) ukuranKertas = parsed.ukuranKertas;
      } catch {}
    }
  }

  return {
    id: current?.id || '',
    kode: current?.kode || '',
    namaToko: current?.nama || 'Ayam Goreng Mitarasa',
    alamat: current?.alamat || '',
    telepon: current?.telepon || '',
    sumber: current?.sumber || 'manual',
    kodePerangkat,
    pesanFooter: current?.catatan_struk || 'Terima kasih atas kunjungan Anda!',
    ukuranKertas,
  };
}

export function simpanProfilOutlet(profil: any): void {
  if (typeof localStorage !== 'undefined') {
    const current = getProfilOutlet();
    const updated = { ...current, ...profil };
    localStorage.setItem('mitarasa_profil_outlet', JSON.stringify(updated));
    if (profil.kodePerangkat) {
      localStorage.setItem('mitarasa_kode_perangkat', profil.kodePerangkat.toUpperCase());
    }
  }
}

// ── CRUD OUTLET (IndexedDB + Supabase) ──

/**
 * Muat semua outlet yang dibuat oleh pengguna (tersimpan di Supabase/IndexedDB)
 */
export async function muatSemuaOutlet(): Promise<OutletItem[]> {
  let outlets: OutletItem[] = [];

  // 1. Ambil dari Supabase (sumber kebenaran data cloud)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('outlet')
        .select('*')
        .order('dibuat_pada', { ascending: true });

      if (!error && data) {
        outlets = data as OutletItem[];

        // Bersihkan dan perbarui cache IndexedDB
        try {
          const db = await getLocalDB();
          if (db.objectStoreNames.contains('outlet')) {
            const tx = db.transaction('outlet', 'readwrite');
            await tx.objectStore('outlet').clear();
            for (const item of outlets) {
              await tx.objectStore('outlet').put(item);
            }
            await tx.done;
          }
        } catch {}

        // Sinkronkan outlet aktif jika belum ada atau tidak valid
        if (outlets.length > 0) {
          if (!outletAktifSignal.value || !outlets.some((o) => o.id === outletAktifSignal.value?.id)) {
            pilihOutletAktif(outlets[0]);
          }
        } else {
          outletAktifSignal.value = null;
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('mitarasa_outlet_aktif_id');
            localStorage.removeItem('mitarasa_profil_outlet');
          }
        }

        return outlets;
      }
    } catch (e) {
      console.warn('Gagal ambil outlet dari Supabase:', e);
    }
  }

  // 2. Ambil dari IndexedDB jika offline
  try {
    const db = await Promise.race([
      getLocalDB(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
    ]);

    if (db && db.objectStoreNames.contains('outlet')) {
      const local = await db.getAll('outlet');
      if (local && local.length > 0) {
        outlets = local;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca outlet dari IndexedDB:', err);
  }

  if (outlets.length > 0) {
    if (!outletAktifSignal.value || !outlets.some((o) => o.id === outletAktifSignal.value?.id)) {
      pilihOutletAktif(outlets[0]);
    }
  } else {
    outletAktifSignal.value = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mitarasa_outlet_aktif_id');
      localStorage.removeItem('mitarasa_profil_outlet');
    }
  }

  return outlets;
}

export async function simpanOutletAdmin(item: OutletItem): Promise<void> {
  const itemToSave: OutletItem = {
    ...item,
    sumber: item.sumber || 'manual',
    diubah_pada: new Date().toISOString(),
  };

  const db = await getLocalDB();
  if (db.objectStoreNames.contains('outlet')) {
    await db.put('outlet', itemToSave);
  }

  // Jika belum ada outlet aktif atau yang disimpan adalah outlet aktif, update
  if (!outletAktifSignal.value || outletAktifSignal.value.id === itemToSave.id) {
    pilihOutletAktif(itemToSave);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('outlet').upsert(itemToSave);
    } catch (e) {
      console.warn('Gagal upsert outlet ke Supabase:', e);
    }
  }
}

/**
 * Impor cabang dari Presensi Donattour ke proyek Kasir Mitarasa
 */
export async function imporOutletDariPresensi(
  lokasi: { id: string; name: string; latitude?: number | null; longitude?: number | null; radius?: number | null },
  customKode?: string,
  customNama?: string
): Promise<OutletItem> {
  const cleanName = lokasi.name.trim();
  // Hilangkan duplikasi kata "Ayam Goreng" jika di Presensi sudah ada
  const subName = cleanName.replace(/^(Ayam\s*Goreng\s*Mitarasa|Ayam\s*Goreng|Mitarasa)\s*[-:]*\s*/i, '').trim();
  const namaOutlet = customNama || (subName ? `Ayam Goreng Mitarasa - ${subName}` : `Ayam Goreng Mitarasa - ${cleanName}`);
  const kodeOutlet = (customKode || (subName || cleanName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)).toUpperCase();

  const item: OutletItem = {
    id: lokasi.id || crypto.randomUUID(),
    kode: kodeOutlet,
    nama: namaOutlet,
    alamat: `Lokasi Presensi: ${cleanName}`,
    telepon: '',
    catatan_struk: `Terima kasih atas kunjungan Anda di Mitarasa ${subName || cleanName}!`,
    aktif: true,
    sumber: 'presensi',
    presensi_location_id: lokasi.id,
    diubah_pada: new Date().toISOString(),
  };

  await simpanOutletAdmin(item);
  return item;
}

/**
 * Sinkronisasi pembaruan nama cabang dari Presensi Donattour
 */
export async function sinkronkanCabangDariPresensi(): Promise<{ diubah: number; daftar: string[] }> {
  const outlets = await muatSemuaOutlet();
  const presensiList = await muatDaftarLokasiPresensi();
  const mapPresensi = new Map(presensiList.map((p) => [p.id, p]));

  let diubah = 0;
  const daftar: string[] = [];

  for (const o of outlets) {
    if (o.sumber === 'presensi' && o.presensi_location_id) {
      const loc = mapPresensi.get(o.presensi_location_id);
      if (loc) {
        const cleanName = loc.name.trim();
        const subName = cleanName.replace(/^(Ayam\s*Goreng\s*Mitarasa|Ayam\s*Goreng|Mitarasa)\s*[-:]*\s*/i, '').trim();
        const namaTerbaru = subName ? `Ayam Goreng Mitarasa - ${subName}` : `Ayam Goreng Mitarasa - ${cleanName}`;
        const kodeTerbaru = (subName || cleanName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();

        if (o.nama !== namaTerbaru || o.kode !== kodeTerbaru) {
          o.nama = namaTerbaru;
          o.kode = kodeTerbaru;
          o.alamat = `Lokasi Presensi: ${cleanName}`;
          o.diubah_pada = new Date().toISOString();
          await simpanOutletAdmin(o);
          diubah++;
          daftar.push(namaTerbaru);
        }
      }
    }
  }

  return { diubah, daftar };
}

export async function hapusOutletAdmin(id: string): Promise<void> {
  const db = await getLocalDB();
  if (db.objectStoreNames.contains('outlet')) {
    await db.delete('outlet', id);
  }

  if (outletAktifSignal.value?.id === id) {
    outletAktifSignal.value = null;
    localStorage.removeItem('mitarasa_outlet_aktif_id');
  }

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('outlet').delete().eq('id', id);
    } catch (e) {
      console.warn('Gagal hapus outlet dari Supabase:', e);
    }
  }
}

// ── HARGA PER OUTLET (Store-Specific Pricing) ──

export async function muatHargaProdukPerOutlet(outletId: string): Promise<HargaProdukOutletItem[]> {
  if (!outletId) return [];
  let list: HargaProdukOutletItem[] = [];

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('harga_produk_outlet')
        .select('*')
        .eq('outlet_id', outletId);

      if (!error && data) {
        list = data as HargaProdukOutletItem[];
        try {
          const db = await getLocalDB();
          if (db.objectStoreNames.contains('harga_produk_outlet')) {
            const tx = db.transaction('harga_produk_outlet', 'readwrite');
            for (const d of data) {
              await tx.objectStore('harga_produk_outlet').put(d as HargaProdukOutletItem);
            }
            await tx.done;
          }
        } catch {}
        return list;
      }
    } catch {}
  }

  try {
    const db = await getLocalDB();
    if (db.objectStoreNames.contains('harga_produk_outlet')) {
      list = await db.getAllFromIndex('harga_produk_outlet', 'by-outlet', outletId);
    }
  } catch (err) {
    console.warn('Gagal membaca harga_produk_outlet dari IndexedDB:', err);
  }

  return list;
}

export async function simpanHargaProdukPerOutlet(
  outletId: string,
  produkId: string,
  harga: number,
  aktif: boolean = true,
  hpp?: number | null,
): Promise<void> {
  const db = await getLocalDB();
  let foundId: string | null = null;

  try {
    if (db.objectStoreNames.contains('harga_produk_outlet')) {
      const existing = await db.getAllFromIndex('harga_produk_outlet', 'by-outlet', outletId);
      const match = existing.find((h) => h.produk_id === produkId);
      if (match) foundId = match.id;
    }
  } catch {}

  const item: HargaProdukOutletItem = {
    id: foundId || crypto.randomUUID(),
    outlet_id: outletId,
    produk_id: produkId,
    harga,
    hpp: hpp !== undefined ? hpp : null,
    aktif,
    diubah_pada: new Date().toISOString(),
  };

  try {
    if (db.objectStoreNames.contains('harga_produk_outlet')) {
      await db.put('harga_produk_outlet', item);
    }
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('harga_produk_outlet').upsert(item);
    } catch (e) {
      console.warn('Gagal upsert harga outlet ke Supabase:', e);
    }
  }
}

export async function hapusHargaKhususProdukOutlet(outletId: string, produkId: string): Promise<void> {
  const db = await getLocalDB();
  let foundId: string | null = null;

  try {
    if (db.objectStoreNames.contains('harga_produk_outlet')) {
      const existing = await db.getAllFromIndex('harga_produk_outlet', 'by-outlet', outletId);
      const match = existing.find((h) => h.produk_id === produkId);
      if (match) foundId = match.id;
    }
  } catch {}

  if (foundId) {
    try {
      if (db.objectStoreNames.contains('harga_produk_outlet')) {
        await db.delete('harga_produk_outlet', foundId);
      }
    } catch {}

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = await getSupabase();
        await supabase.from('harga_produk_outlet').delete().eq('id', foundId);
      } catch {}
    }
  }
}
