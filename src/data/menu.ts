import { getLocalDB, type ProdukItem, type TambahanItem } from './db.js';
import { getSupabase } from './supabase.js';
import { outletAktifSignal, inisialisasiOutletAktif } from './outlet.js';

// Data bawaan offline fallback jika belum tersinkron
const DEFAULT_PRODUK: ProdukItem[] = [
  {
    id: 'prod-1',
    varian: 'Ayam Rempah Jawa',
    paket: 'Reguler',
    isi: 'Nasi, ayam, sambel, lalapan',
    harga: 18000,
    urutan: 1,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    varian: 'Ayam Rempah Jawa',
    paket: 'Komplit',
    isi: 'Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu',
    harga: 25000,
    urutan: 2,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    varian: 'Ayam Goreng Bawang Putih',
    paket: 'Reguler',
    isi: 'Nasi, ayam, sambel, lalapan',
    harga: 18000,
    urutan: 3,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    varian: 'Ayam Goreng Bawang Putih',
    paket: 'Komplit',
    isi: 'Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu',
    harga: 25000,
    urutan: 4,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
];

const DEFAULT_TAMBAHAN: TambahanItem[] = [
  {
    id: 'plus-1',
    nama: 'Upgrade nasi daun jeruk',
    harga: 2000,
    urutan: 1,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'plus-2',
    nama: 'Extra kremes',
    harga: 5000,
    urutan: 2,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'plus-3',
    nama: 'Extra sambel',
    harga: 5000,
    urutan: 3,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
];

/**
 * Muat menu untuk layar kasir POS dengan memperhitungkan harga khusus per outlet/toko
 */
export async function muatMenuLokal(customOutletId?: string): Promise<{ produk: ProdukItem[]; tambahan: TambahanItem[] }> {
  const db = await getLocalDB();
  let produkList = await db.getAllFromIndex('produk', 'by-urutan');
  let tambahanList = await db.getAllFromIndex('tambahan', 'by-urutan');

  // Jika IndexedDB masih kosong, inisialisasi dengan data awal
  if (produkList.length === 0) {
    const tx = db.transaction(['produk', 'tambahan'], 'readwrite');
    for (const p of DEFAULT_PRODUK) {
      await tx.objectStore('produk').put(p);
    }
    for (const t of DEFAULT_TAMBAHAN) {
      await tx.objectStore('tambahan').put(t);
    }
    await tx.done;

    produkList = await db.getAllFromIndex('produk', 'by-urutan');
    tambahanList = await db.getAllFromIndex('tambahan', 'by-urutan');
  }

  // Terapkan penyesuaian harga khusus cabang / outlet
  const targetOutletId = customOutletId || outletAktifSignal.value?.id || inisialisasiOutletAktif()?.id || null;
  if (targetOutletId) {
    try {
      const hargaKhususList = await db.getAllFromIndex('harga_produk_outlet', 'by-outlet', targetOutletId);
      const mapHarga = new Map(hargaKhususList.map((h) => [h.produk_id, h]));

      produkList = produkList.map((p) => {
        const khusus = mapHarga.get(p.id);
        if (khusus) {
          return {
            ...p,
            harga: khusus.harga,
            aktif: khusus.aktif,
          };
        }
        return p;
      });
    } catch {}
  }

  return {
    produk: produkList.filter((p) => p.aktif),
    tambahan: tambahanList.filter((t) => t.aktif),
  };
}

/**
 * Muat semua menu untuk panel Admin (termasuk yang tidak aktif)
 */
export async function muatSemuaMenuAdmin(): Promise<{ produk: ProdukItem[]; tambahan: TambahanItem[] }> {
  const db = await getLocalDB();
  const produkList = await db.getAllFromIndex('produk', 'by-urutan');
  const tambahanList = await db.getAllFromIndex('tambahan', 'by-urutan');
  return { produk: produkList, tambahan: tambahanList };
}

export interface ProdukDenganHargaOutlet {
  produk: ProdukItem;
  hargaKhusus: number | null;
  hargaEfektif: number;
  aktifDiOutlet: boolean;
}

/**
 * Muat daftar produk beserta perbandingan harga master vs harga khusus di outlet tertentu
 */
export async function muatProdukDenganHargaOutlet(outletId: string): Promise<ProdukDenganHargaOutlet[]> {
  const db = await getLocalDB();
  const produkList = await db.getAllFromIndex('produk', 'by-urutan');
  let hargaKhususList: any[] = [];
  try {
    hargaKhususList = await db.getAllFromIndex('harga_produk_outlet', 'by-outlet', outletId);
  } catch {}

  const mapHarga = new Map(hargaKhususList.map((h) => [h.produk_id, h]));

  return produkList.map((p) => {
    const khusus = mapHarga.get(p.id);
    return {
      produk: p,
      hargaKhusus: khusus ? khusus.harga : null,
      hargaEfektif: khusus ? khusus.harga : p.harga,
      aktifDiOutlet: khusus ? khusus.aktif : p.aktif,
    };
  });
}

/**
 * Simpan / perbarui produk (IndexedDB + Supabase jika online)
 */
export async function simpanProdukAdmin(item: ProdukItem): Promise<void> {
  const db = await getLocalDB();
  await db.put('produk', item);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('produk').upsert(item);
    } catch (e) {
      console.warn('Gagal upsert produk ke Supabase:', e);
    }
  }
}

/**
 * Hapus produk
 */
export async function hapusProdukAdmin(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('produk', id);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('produk').delete().eq('id', id);
    } catch (e) {
      console.warn('Gagal hapus produk dari Supabase:', e);
    }
  }
}

/**
 * Simpan / perbarui item tambahan (Add-ons)
 */
export async function simpanTambahanAdmin(item: TambahanItem): Promise<void> {
  const db = await getLocalDB();
  await db.put('tambahan', item);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('tambahan').upsert(item);
    } catch (e) {
      console.warn('Gagal upsert tambahan ke Supabase:', e);
    }
  }
}

/**
 * Hapus item tambahan
 */
export async function hapusTambahanAdmin(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('tambahan', id);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('tambahan').delete().eq('id', id);
    } catch (e) {
      console.warn('Gagal hapus tambahan dari Supabase:', e);
    }
  }
}

export async function sinkronkanMenuDariSupabase(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  try {
    const supabase = await getSupabase();
    const { data: produkData, error: errProduk } = await supabase
      .from('produk')
      .select('*')
      .order('urutan', { ascending: true });

    const { data: tambahanData, error: errTambahan } = await supabase
      .from('tambahan')
      .select('*')
      .order('urutan', { ascending: true });

    if (errProduk || errTambahan) {
      console.warn('Gagal sinkron menu dari server:', errProduk || errTambahan);
      return;
    }

    if (produkData && tambahanData) {
      const db = await getLocalDB();
      const tx = db.transaction(['produk', 'tambahan', 'meta'], 'readwrite');

      for (const p of produkData) {
        await tx.objectStore('produk').put(p as ProdukItem);
      }
      for (const t of tambahanData) {
        await tx.objectStore('tambahan').put(t as TambahanItem);
      }
      await tx.objectStore('meta').put({
        key: 'menu_terakhir_sinkron',
        val: new Date().toISOString(),
      });

      await tx.done;
    }
  } catch (err) {
    console.warn('Sinkron menu dilewati karena koneksi:', err);
  }
}
